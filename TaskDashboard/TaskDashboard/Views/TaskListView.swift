import SwiftUI

struct TaskListView: View {
    @StateObject private var viewModel = TaskListViewModel()
    @State private var showingAddTask = false
    
    var body: some View {
        NavigationView {
            List {
                ForEach(viewModel.tasks) { task in
                    NavigationLink(destination: TaskDetailView(task: task)) {
                        TaskRowView(task: task)
                    }
                }
            }
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingAddTask = true }) {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Logout") {
                        APIService.shared.logout()
                    }
                }
            }
            .sheet(isPresented: $showingAddTask) {
                NavigationView {
                    TaskDetailView(task: nil)
                }
            }
            .refreshable {
                await viewModel.fetchTasks()
            }
            .task {
                await viewModel.fetchTasks()
            }
        }
    }
}
