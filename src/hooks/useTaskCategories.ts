import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TaskCategory {
  id: string;
  role: string;
  category_name: string;
  display_order: number;
  is_default: boolean;
  is_active: boolean;
}

export function useTaskCategories(role: string | null) {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!role) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    const fetchCategories = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("task_categories")
        .select("category_name")
        .eq("role", role)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!error && data) {
        setCategories(data.map((c: { category_name: string }) => c.category_name));
      }
      setIsLoading(false);
    };

    fetchCategories();
  }, [role]);

  return { categories, isLoading };
}

export function useAllTaskCategories() {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("task_categories")
      .select("*")
      .order("role")
      .order("display_order", { ascending: true });

    if (!error && data) {
      setCategories(data as TaskCategory[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, setCategories, isLoading, refetch: fetchCategories };
}

export type { TaskCategory };
