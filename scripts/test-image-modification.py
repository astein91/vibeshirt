#!/usr/bin/env python3
"""
Test script to verify the image generation and modification loop.
Tests that:
1. We can create a session
2. Generate an initial image
3. Modify that image (with the source image passed to Gemini)
"""

import requests
import time
import sys

BASE_URL = "http://localhost:3000"

def create_session(vibe_description="test design"):
    """Create a new design session."""
    print(f"Creating session with vibe: {vibe_description}")
    resp = requests.post(
        f"{BASE_URL}/api/sessions",
        json={"vibeDescription": vibe_description}
    )
    resp.raise_for_status()
    session = resp.json()
    print(f"  ✓ Created session: {session['id']}")
    return session

def send_message(session_id, content, author_name="TestUser"):
    """Send a message to the session."""
    print(f"Sending message: {content[:50]}...")
    resp = requests.post(
        f"{BASE_URL}/api/sessions/{session_id}/messages",
        json={
            "content": content,
            "authorName": author_name
        }
    )
    resp.raise_for_status()
    message = resp.json()
    print(f"  ✓ Message sent: {message['id']}")
    return message

def get_artifacts(session_id):
    """Get all artifacts for a session."""
    resp = requests.get(f"{BASE_URL}/api/sessions/{session_id}/artifacts")
    resp.raise_for_status()
    return resp.json()

def wait_for_new_artifact(session_id, initial_count, timeout=120):
    """Wait for a new artifact to be generated."""
    print(f"Waiting for new artifact (timeout: {timeout}s)...")
    start = time.time()

    while time.time() - start < timeout:
        artifacts = get_artifacts(session_id)
        if len(artifacts) > initial_count:
            new_artifact = artifacts[0]  # Most recent first
            print(f"  ✓ New artifact created: {new_artifact['id']}")
            print(f"    Type: {new_artifact['type']}")
            print(f"    URL: {new_artifact['storageUrl']}")
            if new_artifact.get('sourceArtifactId'):
                print(f"    Source artifact: {new_artifact['sourceArtifactId']}")
            return new_artifact

        time.sleep(2)
        elapsed = int(time.time() - start)
        print(f"    ... waiting ({elapsed}s)", end="\r")

    print(f"  ✗ Timeout waiting for artifact")
    return None

def get_messages(session_id):
    """Get all messages for a session."""
    resp = requests.get(f"{BASE_URL}/api/sessions/{session_id}/messages")
    resp.raise_for_status()
    return resp.json()

def test_generation_loop():
    """Test the full generation and modification loop."""
    print("\n" + "="*60)
    print("TESTING IMAGE GENERATION & MODIFICATION LOOP")
    print("="*60 + "\n")

    # Step 1: Create session
    session = create_session("simple geometric pattern")
    session_id = session["id"]

    # Step 2: Generate initial image
    print("\n--- STEP 1: Generate Initial Image ---")
    initial_artifacts = get_artifacts(session_id)
    initial_count = len(initial_artifacts)

    send_message(
        session_id,
        "create a simple blue circle on the shirt",
        "TestUser"
    )

    # Wait for generation
    artifact1 = wait_for_new_artifact(session_id, initial_count, timeout=90)
    if not artifact1:
        print("\n✗ FAILED: Initial generation did not complete")
        return False

    print(f"\n  Initial artifact ID: {artifact1['id']}")

    # Step 3: Modify the image
    print("\n--- STEP 2: Modify the Image ---")
    time.sleep(2)  # Brief pause

    current_count = len(get_artifacts(session_id))

    send_message(
        session_id,
        "make the circle red instead of blue",
        "TestUser"
    )

    # Wait for modification
    artifact2 = wait_for_new_artifact(session_id, current_count, timeout=90)
    if not artifact2:
        print("\n✗ FAILED: Modification did not complete")
        return False

    # Check if modification used source artifact
    print("\n--- RESULTS ---")
    if artifact2.get('sourceArtifactId'):
        print(f"✓ Modification linked to source: {artifact2['sourceArtifactId']}")
        if artifact2['sourceArtifactId'] == artifact1['id']:
            print("✓ Source artifact matches the original!")
        else:
            print(f"⚠ Source artifact doesn't match original ({artifact1['id']})")
    else:
        print("⚠ No sourceArtifactId set - modification may not have used source image")

    # Print final summary
    print("\n--- SUMMARY ---")
    print(f"Session ID: {session_id}")
    print(f"Initial artifact: {artifact1['id']}")
    print(f"Modified artifact: {artifact2['id']}")
    print(f"Source linked: {artifact2.get('sourceArtifactId', 'None')}")

    # Get messages to see the conversation
    print("\n--- CONVERSATION ---")
    messages = get_messages(session_id)
    for msg in messages:
        role = "USER" if msg['role'] == 'user' else "TAILOR"
        content = msg['content'][:80] + "..." if len(msg['content']) > 80 else msg['content']
        print(f"  [{role}] {content}")

    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60)
    print(f"\nView in browser: {BASE_URL}/design/{session_id}")

    return True

if __name__ == "__main__":
    try:
        success = test_generation_loop()
        sys.exit(0 if success else 1)
    except requests.exceptions.ConnectionError:
        print(f"\n✗ ERROR: Could not connect to {BASE_URL}")
        print("  Make sure the dev server is running: npm run dev")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
