import AppPage from "@/components/site/app-page";
import { authPages } from "@/content/app";

export default function Page() {
  return <AppPage {...authPages[1]} />;
}
