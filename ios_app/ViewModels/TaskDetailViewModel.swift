import Foundation
import SwiftUI
import Combine

@MainActor
class TaskDetailViewModel: ObservableObject {
    // For Editing
    @Published var taskNumber: String = ""
    @Published var description: String = ""
    @Published var assignedAgency: String = ""
    @Published var status: String = "Pending"
    @Published var deadlineDate: Date = Date()
    @Published var priority: String = "Medium"
    
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isSaved = false
    
    private var existingTask: Task?
    
    init(task: Task? = nil) {
        self.existingTask = task
        if let task = task {
            self.taskNumber = task.task_number ?? ""
            self.description = task.description ?? ""
            self.assignedAgency = task.assigned_agency ?? ""
            self.status = task.status ?? "Pending"
            
            // Parse Date
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            if let dateStr = task.deadline_date, let date = formatter.date(from: dateStr) {
                self.deadlineDate = date
            }
            
            self.priority = task.priority ?? "Medium"
        }
    }
    
    func saveTask() async {
        isLoading = true
        errorMessage = nil
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: deadlineDate)
        
        var data: [String: Any] = [
            "description": description,
            "assigned_agency": assignedAgency,
            "status": status,
            "deadline_date": dateString,
            "priority": priority
        ]
        
        do {
            if let task = existingTask {
                // Update
                _ = try await APIService.shared.updateTask(id: task.id, data: data)
            } else {
                // Create
                // Task Number is auto-generated or manual? Backend auto-generates if empty usually, or let's allow user input if needed.
                // Looking at backend: if not task.task_number, it auto-generates.
                if !taskNumber.isEmpty {
                    data["task_number"] = taskNumber
                }
                _ = try await APIService.shared.createTask(data: data)
            }
            isSaved = true
        } catch {
            errorMessage = "Failed to save: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
}
