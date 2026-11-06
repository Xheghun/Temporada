"""Validate saved native observations; this does not rerun Android scenarios."""
import json
from pathlib import Path
import xml.etree.ElementTree as ElementTree

folder = Path(__file__).resolve().parent
checks = []


def load_report(name):
    return json.loads((folder / (name + '.json')).read_text())


def screen_text(name):
    return [node.get('text') for node in ElementTree.parse(folder / (name + '.xml')).iter('node')]


def assert_verified(description, condition):
    assert condition, description
    checks.append(description)


before = load_report('02b-before-restart')
after = load_report('02b-after-restart')
assert_verified('TEST-01/02: original queued action IDs/payloads survive offline process restart', before['actions'] == after['actions'])
assert_verified('M7: private passport remains 523491 bytes with original digest', after['actions'][1]['fileBytes'] == 523491 and after['actions'][1]['digestMatches'])
assert_verified('M4: passport is visibly Pending Sync after restart', 'Pending Sync' in screen_text('02b-offline-restart'))
delivered = load_report('02b-delivered')
server = load_report('02b-delivered-server')
for action in delivered['actions']:
    assert_verified('M3: scenario 2 action delivered exactly once: ' + action['client_action_id'], action['status'] == 'delivered' and sum(receipt['clientActionId'] == action['client_action_id'] for receipt in server['receipts']) == 1)
assert_verified('M4: passport acknowledged Pending Review', 'Pending Review' in screen_text('02b-pending-review') and server['documentSubmissions'][-1]['status'] == 'pending_review')

dropped = load_report('03-delivered')['actions'][-1]
server = load_report('03-delivered-server')
assert_verified('TEST-03: dropped response reuses one ID over two attempts with one submission', dropped['attempt_count'] == 2 and dropped['status'] == 'delivered' and sum(submission['clientActionId'] == dropped['client_action_id'] for submission in server['documentSubmissions']) == 1)

failed = load_report('05-rejected-413')['actions'][-1]
unrelated = load_report('05-unrelated-delivered')['actions']
assert_verified('TEST-04: 413 retains bytes, does not retry and does not block another resource', failed['status'] == 'failed_permanent' and failed['fileBytes'] == 523491 and unrelated[3]['client_action_id'] == failed['client_action_id'] and unrelated[3]['attempt_count'] == 1 and unrelated[-1]['status'] == 'delivered')
backoff = load_report('06-backoff-bounds')
assert_verified('M5: second retry persists bounded jitter', backoff['attempt_count'] == 2 and 1000 <= backoff['observedDelayMs'] <= 2000)
assert_verified('M5: random 500 recovery delivers same replacement ID', load_report('06-backoff')['actions'][-1]['client_action_id'] == load_report('06-delivered')['actions'][-1]['client_action_id'] and load_report('06-delivered')['actions'][-1]['status'] == 'delivered')

assert_verified('TEST-06: worker switching preserves queued IDs and image integrity', load_report('07-isolation-queued')['actions'] == load_report('07-isolation-restored')['actions'])
assert_verified('M10: Bruno has no pending/attention and his own Approved passport', '0 actions pending sync' in screen_text('07-bruno-zero-pending') and '0 actions need attention' in screen_text('07-bruno-zero-pending') and 'Approved' in screen_text('07-bruno-approved') and not any('Carla' in (value or '') for value in screen_text('07-bruno-zero-pending') + screen_text('07-bruno-approved')))
expired = load_report('08-expired')['actions'][-1]
resumed = load_report('08-delivered')['actions'][-1]
assert_verified('M2/M5: 401 preserves queued file and reauthentication delivers original ID', expired['status'] == 'queued' and expired['digestMatches'] and expired['client_action_id'] == resumed['client_action_id'] and resumed['status'] == 'delivered')
assert_verified('M8: Carla correction creates new intent targeting historical seed submission', resumed['payload']['replacesSubmissionId'] == 'seed-carla-passport')

validation = load_report('422-failed')['actions'][-1]
assert_verified('M5: manual retry does not blindly resend 422', validation == load_report('422-after-manual-retry')['actions'][-1] and validation['attempt_count'] == 1 and validation['status'] == 'failed_permanent')
assert_verified('M4: staff Approved reaches UI while receipt remains unresolved', 'Approved' in screen_text('review-approved-awaiting-replay') and any('still pending sync' in (value or '') for value in screen_text('review-approved-awaiting-replay')))
replayed = load_report('review-after-replay')
action = replayed['actions'][-1]
server = load_report('review-after-replay-server')
submission = next(submission for submission in server['documentSubmissions'] if submission['clientActionId'] == action['client_action_id'])
local = next(record for record in replayed['documents'] if record['server_submission_id'] == submission['submissionId'])
assert_verified('TEST-03R: replay resolves delivery without regressing Approved revision', action['status'] == 'delivered' and local['server_status'] == 'approved' and local['server_revision'] == submission['serverRevision'] and sum(record['clientActionId'] == action['client_action_id'] for record in server['documentSubmissions']) == 1)

assert_verified('M2: queued actions and private image survive actual device reboot', load_report('04-before-reboot')['actions'] == load_report('04-after-reboot')['actions'] and load_report('04-after-reboot')['actions'][-1]['digestMatches'])
boot = load_report('04-device-reboot')
assert_verified('M2: kernel boot ID changes and airplane mode persists', boot['before'] != boot['after'] and boot['airplaneBefore'] == boot['airplaneAfter'] == '1')
stale = load_report('04-stale')
server = load_report('04-stale-server')
assert_verified('TEST-05: v2 rejection does not accept any version for Ana automatically', stale['actions'][0]['status'] == 'stale' and not any(acceptance['workerId'] == 'ana' for acceptance in server['acceptances']))
confirmed = load_report('04-v3-delivered')
server = load_report('04-v3-delivered-server')
assert_verified('TEST-05: explicit new v3 ID delivers while v2 remains stale without supersession', confirmed['actions'][0]['status'] == 'stale' and confirmed['actions'][-1]['status'] == 'delivered' and confirmed['actions'][-1]['payload']['termsVersionId'] == 'v3' and confirmed['actions'][-1]['client_action_id'] != confirmed['actions'][0]['client_action_id'] and [acceptance['termsVersionId'] for acceptance in server['acceptances'] if acceptance['workerId'] == 'ana'] == ['v3'])

(folder / 'assertions.json').write_text(json.dumps({'passed': len(checks), 'checks': checks}, indent=2) + '\n')
print(str(len(checks)) + ' saved-evidence assertions passed; this is not a new emulator run.')
