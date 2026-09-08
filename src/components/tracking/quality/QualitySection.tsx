import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QualityTab } from "@/components/tracking/QualityTab";
import { QualityReviewsTab } from "./QualityReviewsTab";

/**
 * Quality area shell. Holds the existing scores view plus new tabs
 * fed live from the iSchool read-only replica.
 */
export function QualitySection() {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-0">
        <QualityTab />
      </TabsContent>

      <TabsContent value="reviews" className="mt-0">
        <QualityReviewsTab />
      </TabsContent>
    </Tabs>
  );
}
