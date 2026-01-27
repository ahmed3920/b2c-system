import { useState, useMemo } from "react";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface UseTaskFiltersOptions {
  tasks: Task[];
}

export function useTaskFilters({ tasks }: UseTaskFiltersOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.description.toLowerCase().includes(query) ||
          task.task_type.toLowerCase().includes(query)
      );
    }

    if (filterType) {
      result = result.filter((task) => task.task_type === filterType);
    }

    if (filterStatus) {
      result = result.filter((task) => task.status === filterStatus);
    }

    if (filterPriority) {
      result = result.filter((task) => task.priority === parseInt(filterPriority));
    }

    if (filterMonth) {
      result = result.filter((task) => {
        const taskMonth = task.date_from?.substring(5, 7) || task.date_to?.substring(5, 7);
        return taskMonth === filterMonth;
      });
    }

    return result;
  }, [tasks, searchQuery, filterType, filterStatus, filterMonth, filterPriority]);

  const clearFilters = () => {
    setFilterType("");
    setFilterStatus("");
    setFilterMonth("");
    setFilterPriority("");
    setSearchQuery("");
  };

  const hasActiveFilters = !!(filterType || filterStatus || filterMonth || filterPriority);

  return {
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    filterMonth,
    setFilterMonth,
    filterPriority,
    setFilterPriority,
    showFilters,
    setShowFilters,
    filteredTasks,
    clearFilters,
    hasActiveFilters,
  };
}
