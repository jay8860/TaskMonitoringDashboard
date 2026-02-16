import Foundation
import SwiftUI
import Combine

@MainActor
class LoginViewModel: ObservableObject {
    @Published var username = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    func login() async {
        isLoading = true
        errorMessage = nil
        
        do {
            _ = try await APIService.shared.login(username: username, password: password)
            // Success - APIService updates global auth state
        } catch {
            errorMessage = "Login failed: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
}
