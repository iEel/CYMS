import { Metadata } from 'next';
import EIRPublicView from './EIRPublicView';

export const metadata: Metadata = {
  title: 'EIR — รายงานสภาพตู้คอนเทนเนอร์',
  description: 'Equipment Interchange Receipt — ดูรูปถ่ายความเสียหายแบบความละเอียดสูง',
};

export default function EIRPublicPage({ params }: { params: Promise<{ id: string }> }) {
  return <EIRPublicView paramsPromise={params} />;
}
