import sqlite3
import json
import hashlib
import os
import random
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dailywork.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Workers table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL UNIQUE,
        age INTEGER,
        gender TEXT,
        address TEXT,
        pincode TEXT,
        aadhar TEXT,
        primary_category TEXT,
        skills TEXT,
        work_mode TEXT,
        wage TEXT,
        experience TEXT,
        last_employer TEXT,
        prev_location TEXT,
        work_desc TEXT,
        projects TEXT,
        education TEXT,
        certs TEXT,
        languages TEXT,
        available_days TEXT,
        start_time TEXT,
        end_time TEXT,
        travel TEXT,
        tools TEXT,
        emergency_contact TEXT,
        status TEXT DEFAULT 'Registered',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 2. Admins table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        company TEXT,
        gst TEXT,
        region TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 3. Jobs table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        admin_id TEXT,
        work_type TEXT NOT NULL,
        icon TEXT,
        worker_count INTEGER NOT NULL,
        skill_level TEXT,
        work_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration TEXT,
        daily_wage TEXT,
        job_desc TEXT,
        special_req TEXT,
        site_address TEXT NOT NULL,
        pincode TEXT,
        landmark TEXT,
        district TEXT,
        radius TEXT,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 4. Job Applications table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        distance_km REAL,
        status TEXT DEFAULT 'Confirmed',
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(job_id, worker_id),
        FOREIGN KEY(job_id) REFERENCES jobs(id),
        FOREIGN KEY(worker_id) REFERENCES workers(id)
    )
    ''')

    # 5. Notifications table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_type TEXT NOT NULL,
        recipient_id TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        notif_type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 6. OTPs table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS otps (
        mobile TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()

    # Seed data if empty
    cursor.execute('SELECT COUNT(*) as count FROM admins')
    if cursor.fetchone()['count'] == 0:
        seed_data(conn)

    conn.close()

def seed_data(conn):
    cursor = conn.cursor()

    # Seed default admin
    admin_id = 'ADM-001'
    admin_mobile = '9876543210'
    admin_pwd_hash = hash_password('admin123')
    cursor.execute('''
    INSERT OR IGNORE INTO admins (id, name, mobile, password_hash, company, gst, region)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (admin_id, 'Suresh Kumar', admin_mobile, admin_pwd_hash, 'SK Constructions Pvt Ltd', '36AAAAA0000A1Z5', 'Hyderabad – Kukatpally'))

    # Seed default jobs
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    day_after = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
    three_days = (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')

    jobs = [
        ('JOB-482910', admin_id, 'Construction & Building', '🏗', 5, 'Experienced', tomorrow, '8:00 AM', 'Full day (8 hrs)', '550',
         'RCC column reinforcement, concrete casting, brickwork alignment for commercial complex G+4.',
         'Safety boots mandatory. Bring helmet if available.', 'Plot 42, KPHB Colony, Kukatpally', '500072', 'Near JNTU Main Gate', 'Hyderabad – Kukatpally', '10 km', 'live'),
        ('JOB-391847', admin_id, 'Electrical Work', '⚡', 2, 'Expert', day_after, '9:00 AM', 'Full day (8 hrs)', '700',
         'Three-phase panel wiring, industrial conduit laying and circuit testing for software office floor.',
         'Must bring basic multi-meter and insulated pliers.', 'Tower B, Cyber Gateway, Hitec City', '500081', 'Opposite Cyber Towers', 'Hyderabad – Gachibowli', '10 km', 'filling'),
        ('JOB-274562', admin_id, 'Plumbing', '🔧', 3, 'Experienced', three_days, '8:00 AM', 'Full day (8 hrs)', '480',
         'CPVC pipe routing, drainage connection and sanitary fixture installations for residential villa.',
         'Pipe wrench and cutting tools provided on site.', 'Road No. 12, Banjara Hills', '500034', 'Near Minar Restaurant', 'Hyderabad – Banjara Hills', '15 km', 'open')
    ]

    for j in jobs:
        cursor.execute('''
        INSERT OR IGNORE INTO jobs (id, admin_id, work_type, icon, worker_count, skill_level, work_date, start_time, duration, daily_wage, job_desc, special_req, site_address, pincode, landmark, district, radius, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', j)

    # Seed initial workers
    initial_workers = [
        ('DW-101010', 'Raju Sharma', '9876511111', 32, 'Male', 'Plot 12, Nizampet Road, Kukatpally', '500072', '9876 5432 1001',
         'Construction & Building', json.dumps(['Brick Laying', 'Masonry', 'Plastering']), 'Daily Contract', '550', '5–10 years',
         'L&T Urban Infra', 'Kukatpally, Hyderabad', 'Experienced mason specializing in brick masonry, plaster finish, and concrete slab work.',
         'Worked on 5-floor residential complex in Kukatpally for 14 months.', '10th Pass (SSC)', 'NSDC Masonry Level 2',
         json.dumps(['Telugu', 'Hindi']), json.dumps(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']), '8:00 AM', '6:00 PM',
         'Upto 10 km', 'Yes, fully equipped', '9876599901', 'Confirmed'),

        ('DW-102020', 'Venkatesh P.', '9123422222', 40, 'Male', 'Phase 3, KPHB Colony', '500072', '9876 5432 1002',
         'Construction & Building', json.dumps(['Woodwork', 'Repairs', 'Scaffolding']), 'Daily Contract', '600', '10+ years',
         'Aparna Constructions', 'Gachibowli, Hyderabad', 'Senior shuttering carpenter and concrete scaffolding specialist.',
         'Supervised shuttering team for Aparna Sarovar G+14 project.', '8th Pass', 'Certified Site Carpenter',
         json.dumps(['Telugu', 'Kannada']), json.dumps(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']), '8:00 AM', '6:00 PM',
         'Upto 15 km', 'Yes, fully equipped', '9123499902', 'Confirmed'),

        ('DW-103030', 'Mohammed Ghouse', '8765433333', 28, 'Male', 'Erragadda, Sanath Nagar', '500018', '9876 5432 1003',
         'Construction & Building', json.dumps(['Metal Fixing', 'Welding', 'Bar Bending']), 'Daily Contract', '500', '3–5 years',
         'My Home Constructions', 'Madhapur, Hyderabad', 'Steel bar bending and TMT rod binding specialist.',
         'Completed bar bending for basement columns at My Home Bhooja.', '10th Pass', 'Bar Bending ITI Apprentice',
         json.dumps(['Urdu', 'Hindi', 'Telugu']), json.dumps(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']), '8:00 AM', '5:00 PM',
         'Upto 10 km', 'Partially', '8765499903', 'Confirmed'),

        ('DW-104040', 'Srinivas Rao', '9987644444', 35, 'Male', 'Moosapet, Hyderabad', '500018', '9876 5432 1004',
         'Construction & Building', json.dumps(['Brick Laying', 'Tiling', 'Flooring']), 'Daily Contract', '520', '5–10 years',
         'NCC Urban', 'Kondapur, Hyderabad', 'Expert tile layer and granolithic floor finisher.',
         'Installed 12,000 sq ft vitrified tiles in luxury apartments.', '10th Pass', 'Tile & Marble Laying Cert',
         json.dumps(['Telugu', 'English']), json.dumps(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']), '8:00 AM', '6:00 PM',
         'Upto 10 km', 'Yes, fully equipped', '9987699904', 'Confirmed'),

        ('DW-105050', 'Lakshmi Devi', '9012355555', 29, 'Female', 'Miyapur, Hyderabad', '500049', '9876 5432 1005',
         'Electrical Work', json.dumps(['Electricals', 'Wiring', 'Appliance Repairs']), 'Daily Contract', '450', '1–2 years',
         'Godrej Consumer Care', 'Chandanagar, Hyderabad', 'Certified residential electrician for lighting, switches, DB wiring.',
         'Carried out wiring and switchboard fittings for 30 duplex villas.', 'ITI Electrician', 'NSDC Electrician Trade',
         json.dumps(['Telugu', 'Hindi']), json.dumps(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']), '9:00 AM', '6:00 PM',
         'Upto 10 km', 'Yes, fully equipped', '9012399905', 'Confirmed'),

        ('DW-106060', 'Arjun Kumar', '8876566666', 31, 'Male', 'Bachupally, Hyderabad', '500090', '9876 5432 1006',
         'Construction & Building', json.dumps(['Repairs', 'Masonry', 'Plastering']), 'Daily Contract', '510', '3–5 years',
         'Ramky Infra', 'Pragathi Nagar', 'General civil construction worker skilled in curing, plastering, and mixing.',
         'Worked on boundary walls and storm water drain masonry.', 'Middle School', 'None',
         json.dumps(['Telugu', 'Hindi']), json.dumps(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']), '8:00 AM', '6:00 PM',
         'Upto 15 km', 'Partially', '8876599906', 'Pending'),

        ('DW-107070', 'Priya Kumari', '9765477777', 26, 'Female', 'Hafeezpet, Hyderabad', '500049', '9876 5432 1007',
         'Construction & Building', json.dumps(['Painting', 'Housekeeping', 'Whitewashing']), 'Daily Contract', '420', '1–2 years',
         'Asian Paints Services', 'Kondapur', 'Wall putty application, interior acrylic painting, and post-construction cleanup.',
         'Assisted painting contractors across 15 newly constructed flats.', '10th Pass', 'Paint Applicator Badge',
         json.dumps(['Hindi', 'Telugu']), json.dumps(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']), '8:00 AM', '5:00 PM',
         'Upto 10 km', 'Yes, fully equipped', '9765499907', 'Confirmed')
    ]

    for w in initial_workers:
        cursor.execute('''
        INSERT OR IGNORE INTO workers (
            id, name, mobile, age, gender, address, pincode, aadhar,
            primary_category, skills, work_mode, wage, experience,
            last_employer, prev_location, work_desc, projects, education,
            certs, languages, available_days, start_time, end_time, travel,
            tools, emergency_contact, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', w)

    # Link workers to initial job applications
    applications = [
        ('JOB-482910', 'DW-101010', 3.2, 'Confirmed'),
        ('JOB-482910', 'DW-102020', 5.8, 'Confirmed'),
        ('JOB-482910', 'DW-103030', 7.1, 'Confirmed'),
        ('JOB-482910', 'DW-104040', 8.4, 'Confirmed'),
        ('JOB-482910', 'DW-105050', 4.2, 'Confirmed'),
        ('JOB-482910', 'DW-106060', 11.3, 'Pending'),
        ('JOB-482910', 'DW-107070', 9.7, 'Confirmed'),
        ('JOB-391847', 'DW-105050', 4.2, 'Confirmed')
    ]

    for app in applications:
        cursor.execute('''
        INSERT OR IGNORE INTO applications (job_id, worker_id, distance_km, status)
        VALUES (?, ?, ?, ?)
        ''', app)

    # Seed initial notifications for Admin
    cursor.execute('''
    INSERT OR IGNORE INTO notifications (recipient_type, recipient_id, title, message, notif_type)
    VALUES (?, ?, ?, ?, ?)
    ''', ('admin', admin_id, 'System Ready', 'DailyWork portal initialized with 3 active job posts and 7 registered workers.', 'system'))

    conn.commit()

# --- HELPER FUNCTIONS ---

def create_worker(data: dict):
    conn = get_db()
    cursor = conn.cursor()
    worker_id = data.get('id') or f"DW-{random.randint(100000, 999999)}"
    skills_json = json.dumps(data.get('skills', [])) if isinstance(data.get('skills'), list) else data.get('skills', '[]')
    languages_json = json.dumps(data.get('languages', [])) if isinstance(data.get('languages'), list) else data.get('languages', '[]')
    days_json = json.dumps(data.get('available_days', [])) if isinstance(data.get('available_days'), list) else data.get('available_days', '[]')

    cursor.execute('''
    INSERT INTO workers (
        id, name, mobile, age, gender, address, pincode, aadhar,
        primary_category, skills, work_mode, wage, experience,
        last_employer, prev_location, work_desc, projects, education,
        certs, languages, available_days, start_time, end_time, travel,
        tools, emergency_contact, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(mobile) DO UPDATE SET
        name=excluded.name,
        age=excluded.age,
        gender=excluded.gender,
        address=excluded.address,
        pincode=excluded.pincode,
        aadhar=excluded.aadhar,
        primary_category=excluded.primary_category,
        skills=excluded.skills,
        work_mode=excluded.work_mode,
        wage=excluded.wage,
        experience=excluded.experience,
        last_employer=excluded.last_employer,
        prev_location=excluded.prev_location,
        work_desc=excluded.work_desc,
        projects=excluded.projects,
        education=excluded.education,
        certs=excluded.certs,
        languages=excluded.languages,
        available_days=excluded.available_days,
        start_time=excluded.start_time,
        end_time=excluded.end_time,
        travel=excluded.travel,
        tools=excluded.tools,
        emergency_contact=excluded.emergency_contact
    ''', (
        worker_id, data.get('name'), data.get('mobile'), data.get('age'), data.get('gender'),
        data.get('address'), data.get('pincode'), data.get('aadhar'), data.get('primary_category'),
        skills_json, data.get('work_mode', 'Daily Contract'), data.get('wage', '₹500'),
        data.get('experience', '1–2 years'), data.get('last_employer', ''), data.get('prev_location', ''),
        data.get('work_desc', ''), data.get('projects', ''), data.get('education', ''),
        data.get('certs', ''), languages_json, days_json,
        data.get('start_time', '8:00 AM'), data.get('end_time', '6:00 PM'),
        data.get('travel', 'Local area only'), data.get('tools', 'Yes, fully equipped'),
        data.get('emergency_contact', ''), data.get('status', 'Confirmed')
    ))

    # Fetch newly saved worker
    cursor.execute('SELECT * FROM workers WHERE mobile = ?', (data.get('mobile'),))
    saved = dict(cursor.fetchone())

    # Create notification for admin
    cursor.execute('''
    INSERT INTO notifications (recipient_type, recipient_id, title, message, notif_type)
    VALUES (?, ?, ?, ?, ?)
    ''', (
        'admin', 'all',
        f"New Worker Registered: {saved['name']}",
        f"{saved['name']} ({saved['primary_category']}) registered from {saved['address'] or 'Local Area'}. Daily rate: {saved['wage']}.",
        'worker_registered'
    ))

    # Auto-match to open jobs with same primary category or general radius
    cursor.execute('SELECT * FROM jobs WHERE status IN ("open", "filling", "live")')
    open_jobs = cursor.fetchall()
    for job in open_jobs:
        if job['work_type'] == saved['primary_category'] or 'Construction' in saved['primary_category']:
            dist = round(random.uniform(2.5, 12.0), 1)
            cursor.execute('''
            INSERT OR IGNORE INTO applications (job_id, worker_id, distance_km, status)
            VALUES (?, ?, ?, ?)
            ''', (job['id'], saved['id'], dist, 'Confirmed'))

    conn.commit()
    conn.close()
    return saved

def get_workers(query=None, trade=None, status=None):
    conn = get_db()
    cursor = conn.cursor()
    sql = 'SELECT * FROM workers WHERE 1=1'
    params = []

    if query:
        sql += ' AND (name LIKE ? OR mobile LIKE ? OR address LIKE ?)'
        params.extend([f"%{query}%", f"%{query}%", f"%{query}%"])
    if trade:
        sql += ' AND primary_category = ?'
        params.append(trade)
    if status:
        sql += ' AND status = ?'
        params.append(status)

    sql += ' ORDER BY created_at DESC'
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    result = []
    for r in rows:
        item = dict(r)
        try:
            item['skills'] = json.loads(item['skills'])
        except:
            item['skills'] = []
        try:
            item['languages'] = json.loads(item['languages'])
        except:
            item['languages'] = []
        try:
            item['available_days'] = json.loads(item['available_days'])
        except:
            item['available_days'] = []
        result.append(item)
    conn.close()
    return result

def get_worker_by_mobile(mobile: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM workers WHERE mobile = ?', (mobile,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    item = dict(row)
    try: item['skills'] = json.loads(item['skills'])
    except: item['skills'] = []
    try: item['languages'] = json.loads(item['languages'])
    except: item['languages'] = []
    try: item['available_days'] = json.loads(item['available_days'])
    except: item['available_days'] = []
    return item

def create_job(data: dict):
    conn = get_db()
    cursor = conn.cursor()
    job_id = f"JOB-{random.randint(100000, 999999)}"
    icons = {
        'Construction & Building': '🏗',
        'Plumbing': '🔧',
        'Electrical Work': '⚡',
        'Carpentry & Furniture': '🪵',
        'Painting & Whitewashing': '🎨',
        'Farming & Agriculture': '🌾',
        'Loading & Unloading': '🚚',
        'Domestic Help & Cleaning': '🏠',
        'Driving & Transport': '🚗',
        'Welding & Fabrication': '🪚',
        'Masonry & Tiling': '🧱'
    }
    work_type = data.get('work_type', 'General Labor')
    icon = icons.get(work_type, '📋')

    cursor.execute('''
    INSERT INTO jobs (
        id, admin_id, work_type, icon, worker_count, skill_level,
        work_date, start_time, duration, daily_wage, job_desc,
        special_req, site_address, pincode, landmark, district,
        radius, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        job_id, data.get('admin_id', 'ADM-001'), work_type, icon,
        int(data.get('worker_count', 3)), data.get('skill_level', 'Any'),
        data.get('work_date'), data.get('start_time', '8:00 AM'),
        data.get('duration', 'Full day (8 hrs)'), data.get('daily_wage', '500'),
        data.get('job_desc', ''), data.get('special_req', ''),
        data.get('site_address', ''), data.get('pincode', ''),
        data.get('landmark', ''), data.get('district', 'Hyderabad'),
        data.get('radius', '10 km'), 'open'
    ))

    # Create notification for workers
    cursor.execute('''
    INSERT INTO notifications (recipient_type, recipient_id, title, message, notif_type)
    VALUES (?, ?, ?, ?, ?)
    ''', (
        'worker', 'all',
        f"New Work Available: {work_type}",
        f"Urgent requirement for {data.get('worker_count', 3)} workers in {data.get('district', 'your area')} starting {data.get('work_date')}. ₹{data.get('daily_wage')}/day.",
        'job_posted'
    ))

    conn.commit()
    cursor.execute('SELECT * FROM jobs WHERE id = ?', (job_id,))
    saved = dict(cursor.fetchone())
    conn.close()
    return saved

def get_jobs(status=None):
    conn = get_db()
    cursor = conn.cursor()
    if status:
        cursor.execute('''
        SELECT j.*, COUNT(a.worker_id) as registered_count
        FROM jobs j
        LEFT JOIN applications a ON j.id = a.job_id
        WHERE j.status = ?
        GROUP BY j.id
        ORDER BY j.created_at DESC
        ''', (status,))
    else:
        cursor.execute('''
        SELECT j.*, COUNT(a.worker_id) as registered_count
        FROM jobs j
        LEFT JOIN applications a ON j.id = a.job_id
        GROUP BY j.id
        ORDER BY j.created_at DESC
        ''')
    rows = cursor.fetchall()
    jobs = [dict(r) for r in rows]
    conn.close()
    return jobs

def apply_for_job(job_id: str, worker_id: str, distance_km: float = None):
    conn = get_db()
    cursor = conn.cursor()
    if distance_km is None:
        distance_km = round(random.uniform(2.0, 11.5), 1)

    cursor.execute('''
    INSERT INTO applications (job_id, worker_id, distance_km, status)
    VALUES (?, ?, ?, 'Confirmed')
    ON CONFLICT(job_id, worker_id) DO UPDATE SET status='Confirmed'
    ''', (job_id, worker_id, distance_km))

    # Get worker and job details for notification
    cursor.execute('SELECT name, primary_category, mobile FROM workers WHERE id = ?', (worker_id,))
    worker = cursor.fetchone()
    cursor.execute('SELECT work_type, site_address FROM jobs WHERE id = ?', (job_id,))
    job = cursor.fetchone()

    if worker and job:
        cursor.execute('''
        INSERT INTO notifications (recipient_type, recipient_id, title, message, notif_type)
        VALUES (?, ?, ?, ?, ?)
        ''', (
            'admin', 'all',
            f"Worker Applied: {worker['name']}",
            f"{worker['name']} ({worker['mobile']}) joined job '{job['work_type']}' at {job['site_address']} ({distance_km} km away).",
            'worker_applied'
        ))

    conn.commit()
    conn.close()
    return {'success': True, 'job_id': job_id, 'worker_id': worker_id, 'distance_km': distance_km, 'status': 'Confirmed'}

def confirm_worker(job_id: str, worker_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    UPDATE applications SET status = 'Confirmed'
    WHERE job_id = ? AND worker_id = ?
    ''', (job_id, worker_id))
    cursor.execute('''
    UPDATE workers SET status = 'Confirmed'
    WHERE id = ?
    ''', (worker_id,))
    conn.commit()
    conn.close()
    return {'success': True, 'status': 'Confirmed'}

def get_job_workers(job_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT w.*, a.distance_km, a.status as application_status, a.applied_at
    FROM applications a
    JOIN workers w ON a.worker_id = w.id
    WHERE a.job_id = ?
    ORDER BY a.applied_at ASC
    ''', (job_id,))
    rows = cursor.fetchall()
    result = []
    for r in rows:
        item = dict(r)
        try: item['skills'] = json.loads(item['skills'])
        except: item['skills'] = []
        result.append(item)
    conn.close()
    return result

def save_otp(mobile: str, otp: str):
    conn = get_db()
    cursor = conn.cursor()
    expires_at = (datetime.now() + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute('''
    INSERT INTO otps (mobile, otp, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(mobile) DO UPDATE SET otp=excluded.otp, expires_at=excluded.expires_at
    ''', (mobile, otp, expires_at))
    conn.commit()
    conn.close()

def verify_otp(mobile: str, entered_otp: str) -> bool:
    # Accept 123456 as master test bypass or the exact generated OTP
    if entered_otp == '123456':
        return True
    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute('SELECT otp FROM otps WHERE mobile = ? AND expires_at >= ?', (mobile, now_str))
    row = cursor.fetchone()
    conn.close()
    if row and row['otp'] == entered_otp:
        return True
    return False

def get_admin_by_mobile(mobile: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM admins WHERE mobile = ?', (mobile,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_admin(name: str, mobile: str, password: str, company: str, gst: str = '', region: str = ''):
    conn = get_db()
    cursor = conn.cursor()
    admin_id = f"ADM-{random.randint(100, 999)}"
    cursor.execute('''
    INSERT INTO admins (id, name, mobile, password_hash, company, gst, region)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(mobile) DO UPDATE SET
        name=excluded.name,
        password_hash=excluded.password_hash,
        company=excluded.company,
        gst=excluded.gst,
        region=excluded.region
    ''', (admin_id, name, mobile, hash_password(password), company, gst, region))
    conn.commit()
    cursor.execute('SELECT * FROM admins WHERE mobile = ?', (mobile,))
    admin = dict(cursor.fetchone())
    conn.close()
    return admin

def get_notifications(recipient_type: str = 'admin', since_id: int = 0):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT * FROM notifications
    WHERE (recipient_type = ? OR recipient_type = 'all') AND id > ?
    ORDER BY id DESC LIMIT 50
    ''', (recipient_type, since_id))
    rows = cursor.fetchall()
    notifs = [dict(r) for r in rows]
    conn.close()
    return notifs

def mark_notification_read(notif_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', (notif_id,))
    conn.commit()
    conn.close()

def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM jobs WHERE status != "closed"')
    active_jobs = cursor.fetchone()['count']
    cursor.execute('SELECT COUNT(*) as count FROM workers')
    total_workers = cursor.fetchone()['count']
    cursor.execute('SELECT COUNT(DISTINCT district) as count FROM jobs')
    active_regions = max(1, cursor.fetchone()['count'])
    cursor.execute('SELECT COUNT(*) as count FROM applications WHERE status = "Confirmed"')
    confirmed_assignments = cursor.fetchone()['count']
    conn.close()
    return {
        'active_jobs': active_jobs,
        'total_workers': total_workers,
        'active_regions': active_regions,
        'confirmed_assignments': confirmed_assignments,
        'hours_to_next_job': 13
    }

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully with default records.")
