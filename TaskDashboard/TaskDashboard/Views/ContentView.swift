import SwiftUI

struct ContentView: View {
    @ObservedObject var apiService = APIService.shared
    
    var body: some View {
        Group {
            if apiService.isAuthenticated {
                TaskListView()
            } else {
                LoginView()
            }
        }
    }
}
