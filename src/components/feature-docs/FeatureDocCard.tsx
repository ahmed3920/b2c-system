import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Pencil,
  Trash2,
  Upload,
  X,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { FeatureDocStatusBadge } from "./FeatureDocStatusBadge";
import {
  FeatureDoc,
  deleteFeatureDoc,
  updateFeatureDoc,
  uploadScreenshot,
} from "@/data/featureDocumentation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  doc: FeatureDoc;
  isAdmin: boolean;
  onEdit: () => void;
  onChanged: () => void;
}

export function FeatureDocCard({ doc, isAdmin, onEdit, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadScreenshot(file, doc.id);
        urls.push(url);
      }
      await updateFeatureDoc(doc.id, { screenshots: [...doc.screenshots, ...urls] });
      toast.success(`${urls.length} screenshot${urls.length > 1 ? "s" : ""} uploaded`);
      onChanged();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeScreenshot = async (url: string) => {
    try {
      await updateFeatureDoc(doc.id, {
        screenshots: doc.screenshots.filter((s) => s !== url),
      });
      onChanged();
    } catch {
      toast.error("Failed to remove");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFeatureDoc(doc.id);
      toast.success("Documentation deleted");
      onChanged();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold leading-tight">{doc.feature_name}</h3>
              <FeatureDocStatusBadge status={doc.status} />
              {doc.route_path && (
                <Link
                  to={doc.route_path}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                  {doc.route_path}
                </Link>
              )}
            </div>
            {doc.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete documentation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove the documentation entry for "{doc.feature_name}".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon">
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="border-t bg-muted/20 p-4 space-y-5">
            {doc.purpose && (
              <Section title="Purpose">
                <p className="text-sm text-foreground/90">{doc.purpose}</p>
              </Section>
            )}
            {doc.functionalities.length > 0 && (
              <Section title="Key Functionalities">
                <ul className="list-disc pl-5 text-sm space-y-1 text-foreground/90">
                  {doc.functionalities.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </Section>
            )}
            {doc.user_roles.length > 0 && (
              <Section title="User Roles">
                <div className="flex flex-wrap gap-1.5">
                  {doc.user_roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </Section>
            )}
            {doc.how_it_works && (
              <Section title="How it works">
                <p className="text-sm whitespace-pre-wrap text-foreground/90">{doc.how_it_works}</p>
              </Section>
            )}
            {doc.ui_explanation && (
              <Section title="UI explanation">
                <p className="text-sm whitespace-pre-wrap text-foreground/90">{doc.ui_explanation}</p>
              </Section>
            )}
            <Section
              title={`Screenshots (${doc.screenshots.length})`}
              action={
                isAdmin && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {uploading ? "Uploading..." : "Upload"}
                    </Button>
                  </>
                )
              }
            >
              {doc.screenshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-background py-8 text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-xs">No screenshots yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {doc.screenshots.map((url) => (
                    <div key={url} className="group relative overflow-hidden rounded-md border bg-background">
                      <a href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`${doc.feature_name} screenshot`}
                          loading="lazy"
                          className="h-32 w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </a>
                      {isAdmin && (
                        <button
                          onClick={() => removeScreenshot(url)}
                          className="absolute top-1 right-1 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                          aria-label="Remove screenshot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
            {doc.notes && (
              <Section title="Internal notes">
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{doc.notes}</p>
              </Section>
            )}
            <p className="text-[11px] text-muted-foreground">
              Last updated {new Date(doc.updated_at).toLocaleString()}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}
