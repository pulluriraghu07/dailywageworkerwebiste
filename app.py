import os
import random
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import database

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=None, template_folder=None)
CORS(app)

import sms_service

# Ensure database is initialized on startup
database.init_db()

@app.route('/')
def index():
    # 1. Check templates/index.html or root index.html
    candidates = [
        os.path.join(BASE_DIR, 'templates', 'index.html'),
        os.path.join(BASE_DIR, 'index.html')
    ]
    for path in candidates:
        if os.path.isfile(path):
            with open(path, 'r', encoding='utf-8') as f:
                return f.read(), 200, {'Content-Type': 'text/html; charset=utf-8'}
    return "<h1>Deployment Error</h1><p>index.html not found on server.</p>", 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    # 1. Check standard static path (e.g. static/css/style.css)
    standard_path = os.path.join(BASE_DIR, 'static', filename)
    if os.path.isfile(standard_path):
        return send_from_directory(os.path.join(BASE_DIR, 'static'), filename)

    # 2. Check flat root path (e.g. style.css directly in project root)
    basename = os.path.basename(filename)
    flat_path = os.path.join(BASE_DIR, basename)
    if os.path.isfile(flat_path):
        return send_from_directory(BASE_DIR, basename)

    # 3. Check static/ with basename
    nested_path = os.path.join(BASE_DIR, 'static', basename)
    if os.path.isfile(nested_path):
        return send_from_directory(os.path.join(BASE_DIR, 'static'), basename)

    return f"Static asset {filename} not found", 404

# --- AUTHENTICATION ROUTES ---

@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json() or {}
    mobile = str(data.get('mobile', '')).strip().replace(' ', '').replace('+91', '')
    if not mobile or len(mobile) < 10:
        return jsonify({'error': 'Please enter a valid 10-digit mobile number'}), 400

    email = str(data.get('email', '')).strip() or None

    otp = str(random.randint(100000, 999999))
    database.save_otp(mobile, otp)

    # Trigger real SMS/Email via configured provider (Brevo, Fast2SMS, 2Factor, Twilio)
    sms_result = sms_service.send_real_otp(mobile, otp, email=email)

    return jsonify({
        'success': True,
        'mobile': mobile,
        'otp': otp,
        'real_sms_sent': sms_result.get('delivered', False),
        'provider': sms_result.get('provider', 'demo_simulator'),
        'sms_status': sms_result.get('message') or sms_result.get('error'),
        'expires_in_seconds': 600,
        'message': f"OTP sent to +91 {mobile}"
    })

@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp_endpoint():
    data = request.get_json() or {}
    mobile = str(data.get('mobile', '')).strip().replace(' ', '').replace('+91', '')
    otp = str(data.get('otp', '')).strip()

    if not database.verify_otp(mobile, otp):
        return jsonify({'error': 'Invalid or expired OTP. Please check and try again.'}), 400

    worker = database.get_worker_by_mobile(mobile)
    admin = database.get_admin_by_mobile(mobile)

    return jsonify({
        'success': True,
        'mobile': mobile,
        'is_registered_worker': bool(worker),
        'worker': worker,
        'is_registered_admin': bool(admin),
        'admin': {k: v for k, v in admin.items() if k != 'password_hash'} if admin else None
    })

@app.route('/api/auth/admin/register', methods=['POST'])
def admin_register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    mobile = str(data.get('mobile', '')).strip().replace(' ', '').replace('+91', '')
    password = data.get('password', '').strip()
    company = data.get('company', '').strip()
    gst = data.get('gst', '').strip()
    region = data.get('region', '').strip()

    if not name or not mobile or not password:
        return jsonify({'error': 'Name, mobile number, and password are required'}), 400

    admin = database.create_admin(name, mobile, password, company, gst, region)
    return jsonify({
        'success': True,
        'admin': {k: v for k, v in admin.items() if k != 'password_hash'}
    })

@app.route('/api/auth/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json() or {}
    mobile = str(data.get('mobile', '')).strip().replace(' ', '').replace('+91', '')
    password = data.get('password', '').strip()
    otp = data.get('otp', '').strip()

    admin = database.get_admin_by_mobile(mobile)
    if not admin:
        return jsonify({'error': 'No admin account found for this mobile. Please sign up first.'}), 404

    # Allow login by password or OTP
    if password:
        if database.hash_password(password) != admin['password_hash']:
            return jsonify({'error': 'Incorrect password'}), 401
    elif otp:
        if not database.verify_otp(mobile, otp):
            return jsonify({'error': 'Invalid or expired OTP'}), 400
    else:
        return jsonify({'error': 'Either password or OTP is required to log in'}), 400

    return jsonify({
        'success': True,
        'admin': {k: v for k, v in admin.items() if k != 'password_hash'}
    })

# --- WORKERS ROUTES ---

@app.route('/api/workers', methods=['GET'])
def list_workers():
    query = request.args.get('q', '').strip()
    trade = request.args.get('trade', '').strip()
    status = request.args.get('status', '').strip()
    workers = database.get_workers(query=query or None, trade=trade or None, status=status or None)
    return jsonify(workers)

@app.route('/api/workers/<worker_id>', methods=['GET'])
def get_worker(worker_id):
    workers = database.get_workers()
    match = next((w for w in workers if w['id'] == worker_id), None)
    if not match:
        return jsonify({'error': 'Worker not found'}), 404
    return jsonify(match)

@app.route('/api/workers', methods=['POST'])
def register_worker():
    data = request.get_json() or {}
    if not data.get('name') or not data.get('mobile'):
        return jsonify({'error': 'Full name and mobile number are required'}), 400

    saved_worker = database.create_worker(data)
    return jsonify({
        'success': True,
        'message': 'Worker registered successfully!',
        'worker': saved_worker
    }), 201

# --- JOBS ROUTES ---

@app.route('/api/jobs', methods=['GET'])
def list_jobs():
    status = request.args.get('status', '').strip()
    jobs = database.get_jobs(status=status or None)
    return jsonify(jobs)

@app.route('/api/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    jobs = database.get_jobs()
    match = next((j for j in jobs if j['id'] == job_id), None)
    if not match:
        return jsonify({'error': 'Job not found'}), 404
    workers = database.get_job_workers(job_id)
    match['workers'] = workers
    return jsonify(match)

@app.route('/api/jobs', methods=['POST'])
def post_job():
    data = request.get_json() or {}
    if not data.get('work_type') or not data.get('site_address'):
        return jsonify({'error': 'Work type and site address are required'}), 400

    new_job = database.create_job(data)
    return jsonify({
        'success': True,
        'message': 'Job posted successfully!',
        'job': new_job
    }), 201

@app.route('/api/jobs/<job_id>/apply', methods=['POST'])
def apply_job(job_id):
    data = request.get_json() or {}
    worker_id = data.get('worker_id')
    if not worker_id:
        return jsonify({'error': 'worker_id is required'}), 400

    res = database.apply_for_job(job_id, worker_id)
    return jsonify(res)

@app.route('/api/jobs/<job_id>/workers/<worker_id>/confirm', methods=['POST'])
def confirm_worker_endpoint(job_id, worker_id):
    res = database.confirm_worker(job_id, worker_id)
    return jsonify(res)

# --- NOTIFICATIONS ROUTES ---

@app.route('/api/notifications', methods=['GET'])
def list_notifications():
    recipient_type = request.args.get('type', 'admin')
    since_id = int(request.args.get('since', 0))
    notifs = database.get_notifications(recipient_type=recipient_type, since_id=since_id)
    return jsonify(notifs)

@app.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def read_notification(notif_id):
    database.mark_notification_read(notif_id)
    return jsonify({'success': True})

# --- STATS ROUTE ---

@app.route('/api/stats', methods=['GET'])
def get_stats():
    stats = database.get_dashboard_stats()
    return jsonify(stats)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"DailyWork server running on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
