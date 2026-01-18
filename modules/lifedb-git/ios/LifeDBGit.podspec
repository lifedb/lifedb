require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LifeDBGit'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/lifedb/lifedb' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Source files: our module + SwiftGit2's Swift sources
  s.source_files = [
    "LifeDBGitModule.swift",
    "SwiftGit2/SwiftGit2/**/*.{h,m,swift}",
    "SwiftGit2/libgit2/**/*.h"
  ]
  
  # Vendored xcframework for libgit2
  s.vendored_frameworks = 'SwiftGit2/External/libgit2-xcframework/libgit2.xcframework'
  
  # Link system libraries that libgit2 depends on
  s.libraries = 'z', 'iconv'
  
  # Frameworks
  s.frameworks = 'Security', 'CFNetwork'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_INCLUDE_PATHS' => '"${PODS_ROOT}/../../modules/lifedb-git/ios/SwiftGit2/libgit2"'
  }
end
