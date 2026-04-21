export const CS_CATEGORIES = [
  "Session Engagement Complaint",
  "Instructor attitude",
  "Delaying start session",
  "End session early",
  "connection issue",
  "Customer Request",
  "Assessment parent meeting",
  "Assessment",
  "Delaying response - Community",
  "General Issue",
] as const;

export const EDU_CATEGORIES = [
  "Instructor attitude",
  "Delaying start session",
  "End session early",
  "Delaying response - Community",
  "Internet Connection Issue",
  "Way of Explanation",
  "Student Didn't understand the session",
  "Missed Session Time Without Compensation",
  "Parent Request",
  "Instructor Unaware of Student Progress",
  "Removed student from meeting",
  "No progress; parent dissatisfied",
  "Poor pronunciation",
  "content related issue",
  "Inaccurate feedback",
  "didn't complete content",
  "Special Case Request",
  "technical issue",
  "didn't review tasks",
  "didn't inform parent with presentation",
  "Late Feedback Submitting",
  "Tech Issue-System",
] as const;

export type CSTicketCaseType = "CS" | "Edu";
export type CSTicketStatus = "Pending" | "Valid" | "Not Valid" | "Not a Complain" | "Validated" | "Rejected";

// Active options shown in dropdowns (legacy values kept for back-compat in old tickets)
export const STATUS_OPTIONS: CSTicketStatus[] = ["Pending", "Valid", "Not Valid", "Not a Complain"];
