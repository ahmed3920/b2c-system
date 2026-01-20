import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, MoreVertical, Eye, Archive, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

const columns: { id: TaskStatus; title: string; className: string }[] = [
  { id: "todo", title: "To-Do", className: "kanban-todo" },
  { id: "in_progress", title: "In Progress", className: "kanban-in-progress" },
  { id: "done", title: "Done", className: "kanban-done" },
  { id: "archived", title: "Archived", className: "kanban-archived" },
];

const TaskCard = ({ task, onView, onArchive }: { task: Task; onView: () => void; onArchive: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const [showMenu, setShowMenu] = useState(false);

  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="bg-card p-3 rounded-lg shadow-sm border border-border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative group">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs px-2 py-0.5 bg-secondary rounded font-medium">{task.task_type}</span>
        <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded">
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <p className="text-sm text-foreground line-clamp-2 mb-2">{task.description}</p>
      {task.date_from && <p className="text-xs text-muted-foreground">{task.date_from}</p>}
      {task.related_link && (
        <a href={task.related_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
          <ExternalLink className="w-3 h-3" /> Link
        </a>
      )}
      {showMenu && (
        <div className="absolute right-0 top-8 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
          <button onClick={() => { onView(); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2">
            <Eye className="w-4 h-4" /> View
          </button>
          {task.status !== "archived" && (
            <button onClick={() => { onArchive(); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-destructive">
              <Archive className="w-4 h-4" /> Archive
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const Column = ({ column, tasks, children }: { column: typeof columns[0]; tasks: Task[]; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div className={`flex-shrink-0 w-72 bg-card rounded-xl ${column.className} ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{column.title}</h3>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
      </div>
      <div ref={setNodeRef} className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

const Kanban = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase.from("tasks").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      setTasks(data || []);
      setIsLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    if (error) {
      setTasks(tasks);
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    }
  };

  const handleArchive = async (task: Task) => {
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: "archived" as TaskStatus } : t));
    await supabase.from("tasks").update({ status: "archived" as TaskStatus }).eq("id", task.id);
  };

  if (isLoading) return <div className="min-h-screen bg-gradient-hero flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const stats = { total: tasks.length, inProgress: tasks.filter(t => t.status === "in_progress").length, done: tasks.filter(t => t.status === "done").length, archived: tasks.filter(t => t.status === "archived").length };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
              <div className="h-6 w-px bg-border" />
              <h1 className="font-bold text-lg text-foreground">Kanban Board</h1>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="px-3 py-1 bg-secondary rounded-full">Total: {stats.total}</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">In Progress: {stats.inProgress}</span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">Done: {stats.done}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="p-6 overflow-x-auto">
        <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {columns.map(column => (
              <Column key={column.id} column={column} tasks={tasks.filter(t => t.status === column.id)}>
                {tasks.filter(t => t.status === column.id).map(task => (
                  <TaskCard key={task.id} task={task} onView={() => setSelectedTask(task)} onArchive={() => handleArchive(task)} />
                ))}
              </Column>
            ))}
          </div>
          <DragOverlay>{activeId ? <div className="bg-card p-3 rounded-lg shadow-xl border-2 border-primary opacity-90">Dragging...</div> : null}</DragOverlay>
        </DndContext>
      </main>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Task Details</DialogTitle></DialogHeader>
          {selectedTask && (
            <div className="space-y-3 py-4">
              <p><strong>Type:</strong> {selectedTask.task_type}</p>
              <p><strong>Description:</strong> {selectedTask.description}</p>
              {selectedTask.date_from && <p><strong>Date:</strong> {selectedTask.date_from} → {selectedTask.date_to}</p>}
              {selectedTask.related_link && <a href={selectedTask.related_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Link</a>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Kanban;
