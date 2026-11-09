import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import typescript from 'typescript';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import i18n from '../core/i18n';
import en from '../core/i18n/en.json';
import es from '../core/i18n/es.json';
import {
  Action,
  ErrorNotice,
  Field,
} from '../design-system/components/auth-controls';
import { tokens } from '../design-system/tokens';
import { DocumentsContent } from '../features/documents/components/documents-content';
import type { DocumentsState } from '../features/documents/documents-service';
import type { OutboxAction } from '../core/offline/domain/types';
import { assignmentFixture } from './persistence-fixtures';
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (value && typeof value === 'object')
    return Object.assign(
      {},
      ...Object.entries(value).map(([key, child]) =>
        leaves(child, prefix ? prefix + '.' + key : key),
      ),
    );
  throw new Error('translation_must_be_string');
}
test('first launch and fallback are Spanish, and both dictionaries have identical keys/interpolation fields', () => {
  expect(i18n.language).toBe('es');
  expect(i18n.options.fallbackLng).toEqual(['es']);
  const english = leaves(en),
    spanish = leaves(es);
  expect(Object.keys(english).sort()).toEqual(Object.keys(spanish).sort());
  for (const key of Object.keys(english)) {
    expect(english[key]?.trim()).not.toBe('');
    expect(spanish[key]?.trim()).not.toBe('');
    const placeholders = (text: string) =>
      [...text.matchAll(/{{\s*([^},]+).*?}}/g)]
        .map((match) => match[1]?.trim())
        .sort();
    expect(placeholders(english[key]!)).toEqual(placeholders(spanish[key]!));
  }
});
for (const language of ['en', 'es'] as const) {
  test(`${language}: every document state is translated and correction free text stays unchanged`, async () => {
    await i18n.changeLanguage(language);
    for (const status of [
      'not_submitted',
      'pending_sync',
      'pending_review',
      'approved',
      'correction_requested',
      'failed',
    ] as const) {
      const assignment = assignmentFixture('ana');
      const actions: OutboxAction[] = [];
      if (
        ['pending_review', 'approved', 'correction_requested'].includes(status)
      )
        assignment.documentSubmissions = [
          {
            submissionId: 'server-passport',
            clientActionId: 'server-passport',
            documentType: 'passport',
            status: status as
              'pending_review' | 'approved' | 'correction_requested',
            correctionReason:
              status === 'correction_requested'
                ? 'Foto borrosa, vuelva a tomarla'
                : null,
            serverRevision: 2,
            createdAt: 100,
          },
        ];
      if (status === 'pending_sync' || status === 'failed')
        actions.push({
          sequence: 1,
          id: '11111111-1111-4111-8111-111111111111',
          clientActionId: '11111111-1111-4111-8111-111111111111',
          workerId: 'ana',
          actionType: 'document_upload',
          payload: {
            kind: 'document_upload',
            workerId: 'ana',
            clientActionId: '11111111-1111-4111-8111-111111111111',
            localSubmissionId: '11111111-1111-4111-8111-111111111111',
            documentType: 'passport',
            sha256: 'a'.repeat(64),
            replacesSubmissionId: null,
          },
          fileUri: 'file:///private/image.jpg',
          status: status === 'failed' ? 'failed_permanent' : 'queued',
          attemptCount: 1,
          nextAttemptAt: 0,
          lastErrorCode: status === 'failed' ? 'local_file_missing' : null,
          createdAt: 100,
          updatedAt: 100,
        });
      const state: DocumentsState = {
        workerId: 'ana',
        generation: 1,
        data: {
          assignment,
          actions,
          cachedAt: 100,
          refreshNeeded: false,
          refreshError: null,
        },
        loading: false,
        saving: false,
        refreshing: false,
        online: false,
        error: null,
        savedActionId: null,
      };
      const rendered = await render(
        <DocumentsContent
          state={state}
          onHome={() => {}}
          onRefresh={() => {}}
        />,
      );
      expect(
        screen.getAllByText(i18n.t('documents.status.' + status)).length,
      ).toBeGreaterThan(0);
      if (status === 'correction_requested')
        expect(
          screen.getByText(
            i18n.t('documents.reason', {
              reason: 'Foto borrosa, vuelva a tomarla',
            }),
          ),
        ).toBeTruthy();
      await rendered.unmount();
    }
  });
  test(`${language}: errors announce localized text, and busy buttons cannot submit again`, async () => {
    await i18n.changeLanguage(language);
    const pressed = jest.fn();
    const rendered = await render(
      <View>
        {Object.keys(en.errors).map((code) => (
          <ErrorNotice key={code} code={code} />
        ))}
        <Action busy label={i18n.t('capture.save')} onPress={pressed} />
        <Field label={i18n.t('phone')} error={i18n.t('errors.invalid_phone')} />
      </View>,
    );
    for (const code of Object.keys(en.errors))
      expect(
        screen.getAllByText(i18n.t('errors.' + code)).length,
      ).toBeGreaterThan(0);
    const button = screen.getByRole('button', { name: i18n.t('capture.save') });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState.busy).toBe(true);
    await fireEvent.press(button);
    expect(pressed).not.toHaveBeenCalled();
    expect(screen.getByLabelText(i18n.t('phone')).props.accessibilityHint).toBe(
      i18n.t('errors.invalid_phone'),
    );
    await rendered.unmount();
  });
}
function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
test('normal/pressed text pairs meet 4.5:1 contrast and interactive input borders meet 3:1', () => {
  const contrast = (left: string, right: string) => {
    const values = [luminance(left), luminance(right)].sort(
      (left, right) => right - left,
    );
    return (values[0]! + 0.05) / (values[1]! + 0.05);
  };
  for (const foreground of [
    tokens.colors.text,
    tokens.colors.muted,
    tokens.colors.error,
    tokens.colors.primary,
    tokens.colors.primaryPressed,
  ])
    expect(contrast(foreground, tokens.colors.surface)).toBeGreaterThanOrEqual(
      4.5,
    );
  expect(
    contrast(tokens.colors.primary, tokens.colors.secondaryPressed),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrast(tokens.colors.muted, tokens.colors.surface),
  ).toBeGreaterThanOrEqual(3);
});

test('literal translation keys used by application screens/services exist in both dictionaries', () => {
  const english = leaves(en),
    spanish = leaves(es);
  const missing: string[] = [];
  function strings(node: typescript.Node): string[] {
    if (
      typescript.isStringLiteral(node) ||
      typescript.isNoSubstitutionTemplateLiteral(node)
    )
      return [node.text];
    if (typescript.isConditionalExpression(node))
      return [...strings(node.whenTrue), ...strings(node.whenFalse)];
    return [];
  }
  function inspect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'testing') inspect(file);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.'))
        continue;
      const source = typescript.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        typescript.ScriptTarget.Latest,
        true,
      );
      function visit(node: typescript.Node) {
        if (
          typescript.isCallExpression(node) &&
          node.arguments[0] &&
          ((typescript.isIdentifier(node.expression) &&
            node.expression.text === 'translate') ||
            (typescript.isPropertyAccessExpression(node.expression) &&
              node.expression.name.text === 't'))
        )
          for (const key of strings(node.arguments[0]))
            if (
              !(english[key] && spanish[key]) &&
              !['one', 'other'].every(
                (form) =>
                  english[`${key}_${form}`] && spanish[`${key}_${form}`],
              )
            )
              missing.push(relative(process.cwd(), file) + ': ' + key);
        typescript.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  inspect(join(process.cwd(), 'app'));
  inspect(join(process.cwd(), 'src'));
  expect(missing).toEqual([]);
});
