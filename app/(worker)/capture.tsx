import { useEffect } from 'react';
import { Linking } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCapture, CaptureContent } from '@/features/capture';
import {
  useDocuments,
  documentViews,
  submissionStatusKey,
} from '@/features/documents';
export default function Capture() {
  const params = useLocalSearchParams<{
    documentType: string;
    workerId: string;
    generation: string;
    expectedSubmissionId: string;
  }>();
  const { state, service } = useCapture();
  const documents = useDocuments();
  const { t: translate, i18n } = useTranslation();
  const ready = !!documents.state.data?.assignment;
  const { documentType, workerId, generation, expectedSubmissionId } = params;
  useEffect(() => {
    if (
      ready &&
      typeof documentType === 'string' &&
      typeof workerId === 'string' &&
      typeof generation === 'string' &&
      typeof expectedSubmissionId === 'string'
    )
      service.open({
        documentType,
        workerId,
        generation: Number(generation),
        expectedSubmissionId: expectedSubmissionId || null,
      });
    return service.close;
  }, [
    service,
    ready,
    documentType,
    workerId,
    generation,
    expectedSubmissionId,
  ]);
  if (!service.isEnabled()) return <Redirect href="/(worker)/documents" />;
  const document = documents.state.data
    ? documentViews(documents.state.data).find(
        (candidate) => candidate.documentType === documentType,
      )
    : null;
  return (
    <CaptureContent
      state={state}
      savedStatus={
        document?.current?.actionId === state.savedActionId
          ? translate(submissionStatusKey(document?.current ?? null))
          : undefined
      }
      label={
        document?.label[i18n.resolvedLanguage === 'en' ? 'en' : 'es'] ??
        translate('capture.title')
      }
      onChoose={(source) => {
        void service.choose(source);
      }}
      onSave={() => {
        void service.save();
      }}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(worker)/documents');
      }}
      onSettings={() => {
        void Linking.openSettings().catch(() => service.settingsFailed());
      }}
    />
  );
}
