{
  "taskId": "qsocial-internal-network",
  "objective": "Biến QSocial thành mạng xã hội nội bộ công ty",
  "workflow": {
    "id": "software-delivery",
    "tasks": [
      {
        "id": "discovery",
        "title": "Define outcome, constraints, and acceptance criteria: Biến QSocial thành mạng xã hội nội bộ công ty",
        "role": "product",
        "dependsOn": [],
        "gate": "spec",
        "requiredEvidence": [
          "requirements",
          "acceptance-criteria"
        ],
        "verifyAfter": true
      },
      {
        "id": "architecture",
        "title": "Design seams, risks, and implementation plan: Biến QSocial thành mạng xã hội nội bộ công ty",
        "role": "architect",
        "dependsOn": [
          "discovery"
        ],
        "gate": "plan",
        "requiredEvidence": [
          "architecture",
          "risk-register"
        ],
        "verifyAfter": true
      },
      {
        "id": "implementation",
        "title": "Implement the approved plan: Biến QSocial thành mạng xã hội nội bộ công ty",
        "role": "backend",
        "dependsOn": [
          "architecture"
        ],
        "gate": "implementation",
        "requiredEvidence": [
          "changed-files",
          "tests"
        ],
        "verifyAfter": true
      },
      {
        "id": "verification",
        "title": "Run focused verification and record direct evidence: Biến QSocial thành mạng xã hội nội bộ công ty",
        "role": "tester",
        "dependsOn": [
          "implementation"
        ],
        "gate": "verification",
        "requiredEvidence": [
          "test-results"
        ]
      },
      {
        "id": "security-review",
        "title": "Review trust boundaries and release risks: Biến QSocial thành mạng xã hội nội bộ công ty",
        "role": "security",
        "dependsOn": [
          "implementation"
        ],
        "gate": "security",
        "requiredEvidence": [
          "security-findings"
        ],
        "verifyAfter": true
      },
      {
        "id": "release-review",
        "title": "Make the release recommendation: Biến QSocial thành mạng xã hội nội bộ công ty",
        "role": "reviewer",
        "dependsOn": [
          "verification",
          "security-review"
        ],
        "gate": "release",
        "requiredEvidence": [
          "verification",
          "security-review",
          "human-approval"
        ]
      }
    ]
  }
}