import Foundation
import Combine

class APIService: ObservableObject {
    static let shared = APIService()
    
    // CHANGE THIS TO YOUR MAC'S LOCAL IP ADDRESS (e.g., "http://192.168.1.5:8000")
    // Use "http://localhost:8000" ONLY for Simulator
    @Published var baseURL = "http://192.168.29.49:8000" 
    
    @Published var isAuthenticated = false
    private var authToken: String? {
        get { UserDefaults.standard.string(forKey: "auth_token") }
        set { 
            UserDefaults.standard.set(newValue, forKey: "auth_token")
            DispatchQueue.main.async {
                self.isAuthenticated = newValue != nil
            }
        }
    }
    
    init() {
        self.isAuthenticated = UserDefaults.standard.string(forKey: "auth_token") != nil
    }
    
    func logout() {
        self.authToken = nil
    }
    
    // MARK: - Auth
    
    func login(username: String, password: String) async throws -> User {
        guard let url = URL(string: "\(baseURL)/api/auth/login") else { throw URLError(.badURL) }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["username": username, "password": password]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        
        if httpResponse.statusCode == 401 { throw URLError(.userAuthenticationRequired) }
        if httpResponse.statusCode != 200 { throw URLError(.badServerResponse) }
        
        let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
        
        DispatchQueue.main.async {
            // Save token
            UserDefaults.standard.set(loginResponse.access_token, forKey: "auth_token")
            self.isAuthenticated = true
        }
        
        return loginResponse.user
    }
    
    // MARK: - Tasks
    
    func fetchTasks() async throws -> [TaskItem] {
        guard let url = URL(string: "\(baseURL)/api/tasks?sort_by=deadline_date") else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        addAuthHeader(to: &request)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        return try JSONDecoder().decode([TaskItem].self, from: data)
    }
    
    func createTask(data: [String: Any]) async throws -> TaskItem {
        guard let url = URL(string: "\(baseURL)/api/tasks/") else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthHeader(to: &request)
        
        request.httpBody = try JSONSerialization.data(withJSONObject: data)
        
        let (responseData, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, ((200...299).contains(httpResponse.statusCode)) else {
            throw URLError(.badServerResponse)
        }
        
        return try JSONDecoder().decode(TaskItem.self, from: responseData)
    }
    
    func updateTask(id: Int, data: [String: Any]) async throws -> TaskItem {
        guard let url = URL(string: "\(baseURL)/api/tasks/\(id)") else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthHeader(to: &request)
        
        request.httpBody = try JSONSerialization.data(withJSONObject: data)
        
        let (responseData, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, ((200...299).contains(httpResponse.statusCode)) else {
            throw URLError(.badServerResponse)
        }
        
        return try JSONDecoder().decode(TaskItem.self, from: responseData)
    }
    
    // MARK: - Helpers
    
    private func addAuthHeader(to request: inout URLRequest) {
        if let token = UserDefaults.standard.string(forKey: "auth_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }
}
