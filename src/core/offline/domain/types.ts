export type DeliveryStatus =
  | 'queued'
  | 'sending'
  | 'retry_wait'
  | 'delivered'
  | 'stale'
  | 'failed_permanent'
  | 'superseded';
export type ReviewStatus =
  'pending_review' | 'approved' | 'correction_requested';
export interface AssignmentSnapshot {
  worker: { workerId: string; displayName: string };
  assignment: {
    orderId: string;
    employer: string;
    worksite: string;
    seasonStart: string;
    seasonEnd: string;
  };
  terms: {
    termsVersionId: string;
    summary: { es: string; en: string };
    serverAcceptanceStatus: 'accepted' | 'not_confirmed';
  };
  requiredDocuments: {
    documentType: string;
    required: boolean;
    label: { es: string; en: string };
  }[];
  documentSubmissions: {
    submissionId: string;
    clientActionId: string;
    documentType: string;
    status: ReviewStatus;
    correctionReason: string | null;
    serverRevision: number;
    createdAt: number;
    replacesSubmissionId?: string | null;
  }[];
  serverRevision: number;
}
export type ActionPayload =
  | {
      kind: 'terms_acceptance';
      clientActionId: string;
      workerId: string;
      termsVersionId: string;
    }
  | {
      kind: 'document_upload';
      clientActionId: string;
      workerId: string;
      documentType: string;
      localSubmissionId: string;
      sha256: string;
      replacesSubmissionId: string | null;
    };
export interface OutboxAction {
  sequence: number;
  id: string;
  workerId: string;
  clientActionId: string;
  actionType: ActionPayload['kind'];
  payload: ActionPayload;
  fileUri: string | null;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: number;
  lastErrorCode: string | null;
  createdAt: number;
  updatedAt: number;
}
/** Supplied only after the file adapter has verified bytes, digest and private durable ownership. */
export interface DurableUpload {
  workerId: string;
  uri: string;
  byteSize: number;
  sha256: string;
}
export interface LocalSubmission {
  submissionId: string;
  documentType: string;
  clientActionId: string | null;
  serverSubmissionId: string | null;
  serverStatus: ReviewStatus | null;
  correctionReason: string | null;
  serverRevision: number | null;
  serverCreatedAt: number | null;
  createdAt: number;
  replacesSubmissionId: string | null;
  deliveryStatus: DeliveryStatus | null;
}
export interface WorkerPersistence {
  cacheAssignment(snapshot: AssignmentSnapshot): Promise<boolean>;
  getAssignment(): Promise<AssignmentSnapshot | null>;
  listSubmissions(): Promise<LocalSubmission[]>;
  listActions(): Promise<OutboxAction[]>;
  eligibleActions(now: number): Promise<OutboxAction[]>;
  enqueueTerms(termsVersionId: string): Promise<OutboxAction>;
  enqueueDocument(
    documentType: string,
    file: DurableUpload,
    replacesSubmissionId?: string,
  ): Promise<OutboxAction>;
  claimAction(clientActionId: string, now: number): Promise<boolean>;
  recoverSending(): Promise<number>;
}
