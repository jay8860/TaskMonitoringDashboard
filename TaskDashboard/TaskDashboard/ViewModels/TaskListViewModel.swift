import Foundation
import SwiftUI
import Combine

@MainActor
class TaskListViewModel: ObservableObject {
    @Published var tasks: [TaskItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    func fetchTasks() async {
        isLoading = true
        errorMessage = nil
        do {
            let fetchedTasks = try await APIService.shared.fetchTasks()
            self.tasks = fetchedTasks
        } catch {
            errorMessage = "Failed to load tasks: \(error.localizedDescription)"
        }
        isLoading = false
    }
}
