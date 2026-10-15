import Catalogue from '../../../screens/Catalogue';
import { Suspense } from 'react';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading catalogue...</p>}>
      <Catalogue />
    </Suspense>
  );
}
