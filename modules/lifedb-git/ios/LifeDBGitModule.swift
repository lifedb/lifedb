import ExpoModulesCore
import Foundation
import Clibgit2

// Initialize libgit2 on module load
private var libgit2Initialized = false

private func ensureLibgit2Initialized() {
    guard !libgit2Initialized else { return }
    git_libgit2_init()
    libgit2Initialized = true
}

// Helper to get error message from libgit2
private func getGitError() -> String {
    if let error = git_error_last() {
        if let message = error.pointee.message {
            return String(cString: message)
        }
    }
    return "Unknown error"
}

// Credential context for passing credentials to C callbacks
private class GitCredentialContext {
    let username: String
    let password: String
    var used: Bool = false  // Prevent infinite credential loops
    
    init(username: String, password: String) {
        self.username = username
        self.password = password
    }
}

// C-compatible credential callback
// This is called by libgit2 when authentication is required
private func credentialCallback(
    cred: UnsafeMutablePointer<UnsafeMutablePointer<git_credential>?>?,
    url: UnsafePointer<CChar>?,
    usernameFromUrl: UnsafePointer<CChar>?,
    allowedTypes: UInt32,
    payload: UnsafeMutableRawPointer?
) -> Int32 {
    guard let payload = payload else {
        return GIT_PASSTHROUGH.rawValue
    }
    
    // Get our credential context from the payload
    let context = Unmanaged<GitCredentialContext>.fromOpaque(payload).takeUnretainedValue()
    
    // Prevent infinite loops - if we've already tried credentials, don't try again
    if context.used {
        NSLog("[Credentials] Already tried credentials, returning error")
        return GIT_EAUTH.rawValue
    }
    context.used = true
    
    NSLog("[Credentials] Callback invoked, providing credentials for user: %@", context.username)
    
    // Check if userpass_plaintext is allowed
    if (allowedTypes & GIT_CREDENTIAL_USERPASS_PLAINTEXT.rawValue) != 0 {
        let result = git_credential_userpass_plaintext_new(
            cred,
            context.username,
            context.password
        )
        if result == GIT_OK.rawValue {
            NSLog("[Credentials] Created plaintext credential successfully")
            return GIT_OK.rawValue
        } else {
            NSLog("[Credentials] Failed to create credential: %@", getGitError())
            return result
        }
    }
    
    NSLog("[Credentials] Userpass not allowed, types: %d", allowedTypes)
    return GIT_PASSTHROUGH.rawValue
}

// Push update reference callback - called for each ref to report the result
private func pushUpdateReferenceCallback(
    refname: UnsafePointer<CChar>?,
    status: UnsafePointer<CChar>?,
    data: UnsafeMutableRawPointer?
) -> Int32 {
    let refnameStr = refname.map { String(cString: $0) } ?? "unknown"
    if let status = status {
        let statusStr = String(cString: status)
        NSLog("[Push] Ref update REJECTED: %@ - %@", refnameStr, statusStr)
    } else {
        NSLog("[Push] Ref update OK: %@", refnameStr)
    }
    return GIT_OK.rawValue
}


public class LifeDBGitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LifeDBGit")

    // Check if the module is available
    Function("isAvailable") {
      return true
    }

    // Clone a repository
    AsyncFunction("clone") { (repoUrl: String, localPath: String, username: String, token: String) -> [String: Any] in
      ensureLibgit2Initialized()
      
      let remoteURL = URL(string: repoUrl)!
      let localURL = URL(fileURLWithPath: localPath)
      
      let credentials = Credentials.plaintext(username: username, password: token)
      let result = Repository.clone(from: remoteURL, to: localURL, credentials: credentials)
      
      switch result {
      case .success(_):
        return ["success": true, "message": "Repository cloned successfully"]
      case .failure(let error):
        return ["success": false, "error": error.localizedDescription]
      }
    }

    // Pull changes from remote (fetch + hard reset to remote)
    // This is a simple but effective approach that ensures local matches remote
    AsyncFunction("pull") { (localPath: String, username: String, token: String) -> [String: Any] in
      ensureLibgit2Initialized()
      
      let localURL = URL(fileURLWithPath: localPath)
      
      // Open repository
      let repoResult = Repository.at(localURL)
      guard case .success(let repo) = repoResult else {
        if case .failure(let error) = repoResult {
          return ["success": false, "error": error.localizedDescription]
        }
        return ["success": false, "error": "Failed to open repository"]
      }
      
      // Save current HEAD for potential rollback
      let headResult = repo.HEAD()
      guard case .success(let headRef) = headResult else {
        return ["success": false, "error": "Failed to get current HEAD"]
      }
      let originalHeadOid = headRef.oid
      
      // Get remotes
      let remotesResult = repo.allRemotes()
      guard case .success(let remotes) = remotesResult, let remote = remotes.first else {
        return ["success": false, "error": "No remote found"]
      }
      
      // Fetch from remote using libgit2 directly with proper credential callback
      NSLog("[Pull] Starting fetch from remote: %@", remote.name ?? "unknown")
      
      // Create credential context and retain it for the callback
      let credContext = GitCredentialContext(username: username, password: token)
      let credContextPtr = Unmanaged.passRetained(credContext).toOpaque()
      
      defer {
        // Release the credential context when done
        Unmanaged<GitCredentialContext>.fromOpaque(credContextPtr).release()
      }
      
      // Get the git_remote pointer for origin
      var gitRemote: OpaquePointer?
      guard git_remote_lookup(&gitRemote, repo.pointer, "origin") == GIT_OK.rawValue else {
        return ["success": false, "error": "Failed to lookup remote: \(getGitError())"]
      }
      defer { git_remote_free(gitRemote) }
      
      // Set up fetch options with credential callback
      var fetchOpts = git_fetch_options()
      git_fetch_options_init(&fetchOpts, UInt32(GIT_FETCH_OPTIONS_VERSION))
      
      // Set the credential callback and payload
      fetchOpts.callbacks.credentials = credentialCallback
      fetchOpts.callbacks.payload = credContextPtr
      
      // Perform fetch (this will connect, authenticate, and fetch in one operation)
      let fetchResult = git_remote_fetch(gitRemote, nil, &fetchOpts, "fetch from LifeDB")
      
      if fetchResult != GIT_OK.rawValue {
        NSLog("[Pull] Fetch failed with code: %d, error: %@", fetchResult, getGitError())
        return ["success": false, "error": "Fetch failed: \(getGitError())"]
      }
      NSLog("[Pull] Fetch completed successfully")
      
      // Use libgit2 directly to get the remote ref (bypasses any SwiftGit2 caching)
      var remoteOid: OID?
      var remoteRef: OpaquePointer?
      
      // Try origin/main first
      if git_reference_lookup(&remoteRef, repo.pointer, "refs/remotes/origin/main") == GIT_OK.rawValue {
        if let oid = git_reference_target(remoteRef) {
          remoteOid = OID(oid.pointee)
          NSLog("[Pull] Found origin/main via libgit2: %@", remoteOid?.description ?? "nil")
        }
        git_reference_free(remoteRef)
      }
      
      // If main not found, try master
      if remoteOid == nil {
        if git_reference_lookup(&remoteRef, repo.pointer, "refs/remotes/origin/master") == GIT_OK.rawValue {
          if let oid = git_reference_target(remoteRef) {
            remoteOid = OID(oid.pointee)
            NSLog("[Pull] Found origin/master via libgit2: %@", remoteOid?.description ?? "nil")
          }
          git_reference_free(remoteRef)
        }
      }
      
      guard let targetRemoteOid = remoteOid else {
        NSLog("[Pull] ERROR: Could not find remote ref via libgit2")
        return ["success": false, "error": "Could not find origin/main or origin/master"]
      }
      
      let remoteOidStr = targetRemoteOid.description
      NSLog("[Pull] Remote OID: %@", remoteOidStr)
      NSLog("[Pull] Local OID: %@", originalHeadOid.description)
      // Check if already at the remote commit
      let localOidStr = originalHeadOid.description
      if localOidStr == remoteOidStr {
        return ["success": true, "message": "Already up to date (at \(String(localOidStr.prefix(7))))"]
      }
      
      // Parse remote OID for reset
      var remoteOidC = git_oid()
      guard git_oid_fromstr(&remoteOidC, remoteOidStr) == GIT_OK.rawValue else {
        return ["success": false, "error": "Invalid remote OID: \(remoteOidStr)"]
      }
      
      // Check for uncommitted changes before resetting
      let statusResult = repo.status()
      if case .success(let entries) = statusResult, !entries.isEmpty {
        return ["success": false, "error": "You have local uncommitted changes. Commit or stash them first."]
      }
      
      // Get the remote commit object
      var remoteCommit: OpaquePointer?
      guard git_commit_lookup(&remoteCommit, repo.pointer, &remoteOidC) == GIT_OK.rawValue else {
        return ["success": false, "error": "Failed to lookup remote commit: \(getGitError())"]
      }
      defer { git_commit_free(remoteCommit) }
      
      // Hard reset to the remote commit
      var checkoutOpts = git_checkout_options()
      git_checkout_options_init(&checkoutOpts, UInt32(GIT_CHECKOUT_OPTIONS_VERSION))
      checkoutOpts.checkout_strategy = UInt32(GIT_CHECKOUT_FORCE.rawValue)
      
      let resetResult = git_reset(repo.pointer, remoteCommit, GIT_RESET_HARD, &checkoutOpts)
      
      if resetResult != GIT_OK.rawValue {
        // Try to rollback to original HEAD
        var originalOidC = git_oid()
        git_oid_fromstr(&originalOidC, localOidStr)
        var originalCommit: OpaquePointer?
        if git_commit_lookup(&originalCommit, repo.pointer, &originalOidC) == GIT_OK.rawValue {
          git_reset(repo.pointer, originalCommit, GIT_RESET_HARD, &checkoutOpts)
          git_commit_free(originalCommit)
        }
        return ["success": false, "error": "Reset failed: \(getGitError()). Rolled back."]
      }
      
      return [
        "success": true, 
        "message": "Updated from \(String(localOidStr.prefix(7))) to \(String(remoteOidStr.prefix(7)))"
      ]
    }

    // Push changes to remote
    AsyncFunction("push") { (localPath: String, username: String, token: String, commitMessage: String) -> [String: Any] in
      ensureLibgit2Initialized()
      
      let localURL = URL(fileURLWithPath: localPath)
      
      // Open repository
      let repoResult = Repository.at(localURL)
      guard case .success(let repo) = repoResult else {
        if case .failure(let error) = repoResult {
          return ["success": false, "error": error.localizedDescription]
        }
        return ["success": false, "error": "Failed to open repository"]
      }
      
      // Stage all changes
      let addResult = repo.add(path: ".")
      guard case .success = addResult else {
        if case .failure(let error) = addResult {
          return ["success": false, "error": "Failed to stage files: \(error.localizedDescription)"]
        }
        return ["success": false, "error": "Failed to stage files"]
      }
      
      // Check if there are any changes to commit
      let statusResult = repo.status()
      var hasChanges = false
      if case .success(let entries) = statusResult {
        hasChanges = !entries.isEmpty
      }
      
      var madeCommit = false
      if hasChanges {
        // Create commit only if there are changes
        let signature = Signature(name: username, email: "\(username)@users.noreply.github.com")
        let commitResult = repo.commit(message: commitMessage, signature: signature)
        
        switch commitResult {
        case .success(_):
          NSLog("[Push] Created commit")
          madeCommit = true
        case .failure(let error):
          // If commit fails with "nothing to commit", that's ok
          if error.localizedDescription.contains("nothing to commit") {
            NSLog("[Push] Nothing to commit (index clean)")
          } else {
            return ["success": false, "error": "Failed to commit: \(error.localizedDescription)"]
          }
        }
      } else {
        NSLog("[Push] No changes to commit")
      }
      
      // Push using libgit2 directly with credential callback (same pattern as fetch)
      NSLog("[Push] Starting push to remote")
      
      // Create credential context and retain it for the callback
      let credContext = GitCredentialContext(username: username, password: token)
      let credContextPtr = Unmanaged.passRetained(credContext).toOpaque()
      
      defer {
        // Release the credential context when done
        Unmanaged<GitCredentialContext>.fromOpaque(credContextPtr).release()
      }
      
      // Get the git_remote pointer for origin
      var gitRemote: OpaquePointer?
      guard git_remote_lookup(&gitRemote, repo.pointer, "origin") == GIT_OK.rawValue else {
        NSLog("[Push] Failed to lookup remote origin: %@", getGitError())
        return ["success": false, "error": "Failed to lookup remote: \(getGitError())"]
      }
      defer { git_remote_free(gitRemote) }
      
      // Log the remote URL
      if let remoteUrl = git_remote_url(gitRemote) {
        NSLog("[Push] Remote URL: %@", String(cString: remoteUrl))
      }
      
      // Set up push options with credential callback
      var pushOpts = git_push_options()
      git_push_options_init(&pushOpts, UInt32(GIT_PUSH_OPTIONS_VERSION))
      
      // Set the credential callback and payload
      pushOpts.callbacks.credentials = credentialCallback
      pushOpts.callbacks.payload = credContextPtr
      pushOpts.callbacks.push_update_reference = pushUpdateReferenceCallback
      
      // Build the refspec for pushing current branch
      // Get the current branch name
      var head: OpaquePointer?
      guard git_repository_head(&head, repo.pointer) == GIT_OK.rawValue else {
        NSLog("[Push] Failed to get HEAD: %@", getGitError())
        return ["success": false, "error": "Failed to get HEAD: \(getGitError())"]
      }
      defer { git_reference_free(head) }
      
      guard let branchName = git_reference_shorthand(head) else {
        NSLog("[Push] Failed to get branch name")
        return ["success": false, "error": "Failed to get branch name"]
      }
      let branchNameStr = String(cString: branchName)
      let refspec = "refs/heads/\(branchNameStr):refs/heads/\(branchNameStr)"
      NSLog("[Push] Pushing refspec: %@", refspec)
      
      // Create refspec array
      var refspecStr = strdup(refspec)
      defer { free(refspecStr) }
      
      var refspecs = git_strarray()
      var refspecPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>? = UnsafeMutablePointer.allocate(capacity: 1)
      refspecPtr?.pointee = refspecStr
      refspecs.strings = refspecPtr
      refspecs.count = 1
      defer { refspecPtr?.deallocate() }
      
      // Perform push
      let pushResult = git_remote_push(gitRemote, &refspecs, &pushOpts)
      
      if pushResult != GIT_OK.rawValue {
        let errorMsg = getGitError()
        NSLog("[Push] Push failed with code: %d, error: %@", pushResult, errorMsg)
        return ["success": false, "error": "Push failed: \(errorMsg)"]
      }
      
      NSLog("[Push] Push completed successfully")
      if madeCommit {
        return ["success": true, "message": "Pushed successfully"]
      } else {
        return ["success": true, "message": "Nothing to push"]
      }
    }

    // Check if a path is a git repository
    AsyncFunction("isRepository") { (localPath: String) -> Bool in
      ensureLibgit2Initialized()
      
      let localURL = URL(fileURLWithPath: localPath)
      let result = Repository.at(localURL)
      
      switch result {
      case .success(_):
        return true
      case .failure(_):
        return false
      }
    }

    // Get repository status
    AsyncFunction("status") { (localPath: String) -> [String: Any] in
      ensureLibgit2Initialized()
      
      let localURL = URL(fileURLWithPath: localPath)
      
      let repoResult = Repository.at(localURL)
      guard case .success(_) = repoResult else {
        if case .failure(let error) = repoResult {
          return ["success": false, "error": error.localizedDescription]
        }
        return ["success": false, "error": "Failed to open repository"]
      }
      
      return [
        "success": true,
        "modified": [] as [String],
        "added": [] as [String],
        "deleted": [] as [String],
        "total": 0
      ]
    }
  }
}
