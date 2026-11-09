import { Suspense } from "react";
import FacilitiesScreen from "@/components/site/facilities/facilities-screen";

export default function Page() {
  // useSearchParams (the ?sos=1 flag) needs a Suspense boundary for static prerendering.
  return (
    <Suspense>
      <FacilitiesScreen />
    </Suspense>
  );
}
