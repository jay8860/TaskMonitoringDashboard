import Foundation

struct LoginResponse: Codable {
    let access_token: String
    let token_type: String
    let user: User
}
