import SwiftUI

struct TaskRowView: View {
    let task: TaskItem
    
    var statusColor: Color {
        switch task.status {
        case "Completed": return .green
        case "Overdue": return .red
        default: return .orange
        }
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 5) {
                Text(task.title)
                    .font(.headline)
                if let desc = task.description {
                    Text(desc)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                HStack {
                    if let agency = task.assigned_agency {
                        Text(agency)
                            .font(.caption)
                            .padding(4)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(4)
                    }
                    if let deadline = task.deadline_date {
                        Text("Due: \(deadline)")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
            }
            Spacer()
            
            if task.isPinnedBool {
                Image(systemName: "pin.fill")
                    .foregroundColor(.yellow)
            }
            
            Text(task.status ?? "Pending")
                .font(.caption)
                .bold()
                .padding(6)
                .background(statusColor.opacity(0.2))
                .foregroundColor(statusColor)
                .cornerRadius(8)
        }
        .padding(.vertical, 4)
    }
}
