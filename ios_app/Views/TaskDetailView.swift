import SwiftUI

struct TaskDetailView: View {
    @StateObject var viewModel: TaskDetailViewModel
    @Environment(\.presentationMode) var presentationMode
    
    // If creating a new task, task is nil
    init(task: Task? = nil) {
        _viewModel = StateObject(wrappedValue: TaskDetailViewModel(task: task))
    }
    
    var body: some View {
        Form {
            Section(header: Text("Task Details")) {
                TextField("Task Number", text: $viewModel.taskNumber)
                TextField("Description", text: $viewModel.description)
                TextField("Assigned Agency", text: $viewModel.assignedAgency)
            }
            
            Section(header: Text("Status & Priority")) {
                Picker("Status", selection: $viewModel.status) {
                    Text("Pending").tag("Pending")
                    Text("In Progress").tag("In Progress")
                    Text("Completed").tag("Completed")
                    Text("Overdue").tag("Overdue")
                }
                
                Picker("Priority", selection: $viewModel.priority) {
                    Text("High").tag("High")
                    Text("Medium").tag("Medium")
                    Text("Low").tag("Low")
                }
            }
            
            Section(header: Text("Dates")) {
                DatePicker("Deadline", selection: $viewModel.deadlineDate, displayedComponents: .date)
            }
            
            Section {
                Button(action: {
                    Task {
                        await viewModel.saveTask()
                        if viewModel.isSaved {
                            presentationMode.wrappedValue.dismiss()
                        }
                    }
                }) {
                    if viewModel.isLoading {
                        ProgressView()
                    } else {
                        Text("Save Task")
                    }
                }
            }
            
            if let error = viewModel.errorMessage {
                Section {
                    Text(error).foregroundColor(.red)
                }
            }
        }
        .navigationTitle(viewModel.taskNumber.isEmpty ? "New Task" : viewModel.taskNumber)
    }
}
