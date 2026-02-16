import Foundation

struct User: Codable, Identifiable {
    let id: Int
    let username: String
    let role: String
    let email: String?
}
