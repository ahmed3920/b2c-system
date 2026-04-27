import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import { VisionBoard } from "@/components/vision-board/VisionBoard";

export default function VisionBoardPage() {
  return (
    <AppLayout title="Vision Board" allowedRoles={["admin"]}>
      <div className="p-6 max-w-[1600px] mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              B2C Vision Board
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Strategic plans organized by urgency. Drag cards between columns to update priority.
            </p>
          </CardHeader>
          <CardContent>
            <VisionBoard />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
