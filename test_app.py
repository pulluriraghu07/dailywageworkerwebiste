import database
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_tests():
    print("Initializing DB...")
    database.init_db()

    # 1. Check initial workers
    workers = database.get_workers()
    print(f"Initial workers count: {len(workers)}")
    assert len(workers) >= 7, "Expected at least 7 seeded workers"

    # 2. Check initial jobs
    jobs = database.get_jobs()
    print(f"Initial jobs count: {len(jobs)}")
    assert len(jobs) >= 3, "Expected at least 3 seeded jobs"

    # 3. Test OTP logic
    database.save_otp("9999988888", "654321")
    assert database.verify_otp("9999988888", "654321") is True, "OTP verification should succeed"
    assert database.verify_otp("9999988888", "000000") is False, "Wrong OTP should fail"
    assert database.verify_otp("9999988888", "123456") is True, "Master bypass OTP should succeed"
    print("✓ OTP verification test passed")

    # 4. Test Worker Registration
    new_worker = database.create_worker({
        "name": "Kavitha Reddy",
        "mobile": "9888877777",
        "primary_category": "Painting & Whitewashing",
        "wage": "₹500",
        "skills": ["Painting", "Wall Putty"],
        "address": "Kukatpally, Hyderabad"
    })
    print(f"✓ Worker Registered: {new_worker['id']} - {new_worker['name']}")
    assert new_worker['name'] == "Kavitha Reddy"

    # 5. Check Admin
    admin = database.get_admin_by_mobile("9876543210")
    print(f"✓ Admin Found: {admin['name']} - {admin['company']}")
    assert admin is not None
    assert admin['name'] == "Suresh Kumar"

    # 6. Check Notifications
    notifs = database.get_notifications("admin")
    print(f"✓ Admin Notifications count: {len(notifs)}")
    assert len(notifs) >= 1

    # 7. Test Job Creation
    new_job = database.create_job({
        "work_type": "Plumbing",
        "worker_count": 4,
        "site_address": "Kondapur, Hyderabad",
        "work_date": "2026-10-05",
        "daily_wage": "600"
    })
    print(f"✓ Job Created: {new_job['id']} - {new_job['work_type']}")

    # 8. Test Worker Application
    app_res = database.apply_for_job(new_job['id'], new_worker['id'])
    print(f"✓ Worker Applied: {app_res['job_id']} by {app_res['worker_id']}")

    print("\nAll backend database & workflow tests PASSED successfully! 🎉")

if __name__ == '__main__':
    run_tests()
