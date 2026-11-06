export const workers = [
  { workerId: 'ana', displayName: 'Ana López', phoneNumber: '+525510000001' },
  {
    workerId: 'bruno',
    displayName: 'Bruno Díaz',
    phoneNumber: '+525510000002',
  },
  {
    workerId: 'carla',
    displayName: 'Carla Díaz',
    phoneNumber: '+525510000002',
  },
] as const;

export const assignment = {
  orderId: 'JO-2026-0142',
  employer: 'Valle Verde Farms',
  worksite: 'Yuma, Arizona',
  seasonStart: '2026-03-01',
  seasonEnd: '2026-07-31',
};

export const documentCatalog = [
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
] as const;
