import type { AssignmentSnapshot } from '../core/offline/domain/types.ts';

/** Fictional cache fixtures only; no networking or session bypass in production flows. */
export function assignmentFixture(workerId: string): AssignmentSnapshot {
  return {
    worker: {
      workerId,
      displayName:
        workerId === 'ana'
          ? 'Ana López'
          : workerId === 'carla'
            ? 'Carla Díaz'
            : 'Bruno Díaz',
    },
    assignment: {
      orderId: 'JO-2026-0142',
      employer: 'Valle Verde Farms',
      worksite: 'Yuma, Arizona',
      seasonStart: '2026-03-01',
      seasonEnd: '2026-07-31',
    },
    terms: {
      termsVersionId: 'v2',
      summary: { es: 'Condiciones v2 de prueba', en: 'Test terms v2' },
      serverAcceptanceStatus:
        workerId === 'bruno' ? 'accepted' : 'not_confirmed',
    },
    requiredDocuments: [
      {
        documentType: 'passport',
        required: true,
        label: { es: 'Pasaporte', en: 'Passport' },
      },
      {
        documentType: 'ds160_confirmation',
        required: true,
        label: { es: 'Confirmación DS-160', en: 'DS-160 confirmation' },
      },
      {
        documentType: 'signed_contract',
        required: true,
        label: { es: 'Contrato firmado', en: 'Signed contract' },
      },
    ],
    documentSubmissions:
      workerId === 'carla'
        ? [
            {
              submissionId: 'seed-carla-passport',
              clientActionId: 'seed-carla-passport',
              documentType: 'passport',
              status: 'correction_requested',
              correctionReason: 'Foto borrosa, vuelva a tomarla',
              serverRevision: 1,
              createdAt: 1,
            },
          ]
        : [],
    serverRevision: 1,
  };
}
