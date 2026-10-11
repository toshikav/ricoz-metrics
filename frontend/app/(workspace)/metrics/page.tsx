import Catalogue from '../../../src/screens/Catalogue';
import { Suspense } from 'react';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading catalogue...</p>}>
      <Catalogue />
    </Suspense>
  );
}
