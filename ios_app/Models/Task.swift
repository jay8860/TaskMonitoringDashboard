import Foundation

struct Task: Codable, Identifiable, Hashable {
    let id: Int
    let task_number: String?
    let description: String?
    let assigned_agency: String?
    let priority: String?
    let allocated_date: String? // Date string from backend (YYYY-MM-DD)
    let deadline_date: String? // Date string from backend (YYYY-MM-DD)
    let status: String?
    let remarks: String?
    let deadline_due_in: String?
    let time_given: String?
    let is_pinned: Int? // 0 or 1
    let scheduled_date: String? // Date string
    let attachment_data: String? // Base64 string
    
    // Computed property for display
    var title: String {
        return task_number ?? "Untitled Task"
    }
    
    var isPinnedBool: Bool {
        return is_pinned == 1
    }
}
