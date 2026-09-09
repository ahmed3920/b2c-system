import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QualityOverviewTab } from "./QualityOverviewTab";
import { QualityReviewsTab } from "./QualityReviewsTab";
import { QualitySessionDetailsTab } from "./QualitySessionDetailsTab";
import { QualityMentorCommentsTab } from "./QualityMentorCommentsTab";
import { QualitySummaryTab } from "./QualitySummaryTab";
import { QualityCycleComparisonTab } from "./QualityCycleComparisonTab";
import { QualityCoverageTab } from "./QualityCoverageTab";

const SUB_TABS = ["overview", "reviews", "sessions", "comments", "summary", "cycles", "coverage"] as const;
type SubTab = (typeof SUB_TABS)[number];

/**
 * Quality area shell. Holds the existing scores view plus tabs
 * fed live from the iSchool read-only replica.
 * Deep link: /performance?tab=quality&review=<id> opens that review.
 */
export function QualitySection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subParam = searchParams.get("sub");
  const reviewParam = searchParams.get("review");
  const [tab, setTab] = useState<SubTab>(
    reviewParam ? "sessions" : SUB_TABS.includes(subParam as SubTab) ? (subParam as SubTab) : "overview",
  );
  const [openReview, setOpenReview] = useState<string | null>(reviewParam);

  // React to later notification clicks while already on this page
  useEffect(() => {
    if (reviewParam) {
      setOpenReview(reviewParam);
      setTab("sessions");
    }
  }, [reviewParam]);

  const handleOpened = useCallback(() => {
    setOpenReview(null);
    if (searchParams.has("review")) {
      const next = new URLSearchParams(searchParams);
      next.delete("review");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as SubTab);
        const next = new URLSearchParams(searchParams);
        next.set("sub", v);
        setSearchParams(next, { replace: true });
      }}
      className="space-y-4"
    >
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="sessions">Session Details</TabsTrigger>
        <TabsTrigger value="comments">Mentor Comments</TabsTrigger>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="cycles">Cycle Comparison</TabsTrigger>
        <TabsTrigger value="coverage">Review Coverage</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-0">
        <QualityOverviewTab />
      </TabsContent>
      <TabsContent value="reviews" className="mt-0">
        <QualityReviewsTab />
      </TabsContent>
      <TabsContent value="sessions" className="mt-0">
        <QualitySessionDetailsTab openReviewId={openReview} onOpenedReview={handleOpened} />
      </TabsContent>
      <TabsContent value="comments" className="mt-0">
        <QualityMentorCommentsTab />
      </TabsContent>
      <TabsContent value="summary" className="mt-0">
        <QualitySummaryTab />
      </TabsContent>
      <TabsContent value="cycles" className="mt-0">
        <QualityCycleComparisonTab />
      </TabsContent>
      <TabsContent value="coverage" className="mt-0">
        <QualityCoverageTab />
      </TabsContent>
    </Tabs>
  );
}
