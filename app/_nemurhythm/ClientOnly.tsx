'use client';

import dynamic from 'next/dynamic';

// localStorage と現在時刻に依存するアプリなので、サーバーでは描画しない
const NemurhythmApp = dynamic(() => import('./NemurhythmApp'), {
  ssr: false,
  loading: () => <div className="phone" />,
});

export default function ClientOnly() {
  return <NemurhythmApp />;
}
