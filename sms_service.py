import os
import json
import urllib.request
import urllib.error
import urllib.parse
import base64

# Load .env file if present in the project directory
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')

def load_env():
    if os.path.exists(ENV_PATH):
        try:
            with open(ENV_PATH, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    key, val = line.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key:
                        os.environ[key] = val
        except Exception as e:
            print(f"Notice: Could not parse .env: {e}")

load_env()

def send_brevo_email(brevo_key: str, to_email: str, otp: str, sender_email: str = None) -> dict:
    """
    Sends a transactional OTP email using Brevo's v3 SMTP API.
    Brevo provides 300 free emails per day with zero DLT or telecom restrictions.
    """
    try:
        url = "https://api.brevo.com/v3/smtp/email"
        from_email = sender_email or to_email
        payload = json.dumps({
            "sender": {
                "name": "DailyWork Support",
                "email": from_email
            },
            "to": [
                {"email": to_email}
            ],
            "subject": f"DailyWork - Your OTP Verification Code is {otp}",
            "htmlContent": f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <span style="font-size: 28px; margin-right: 10px;">⚡</span>
                    <h2 style="margin: 0; color: #111827; font-size: 22px;">DailyWork Verification</h2>
                </div>
                <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">
                    Use the 6-digit one-time password below to sign in or complete your registration on DailyWork:
                </p>
                <div style="background: #f8fafc; border: 2px dashed #f59e0b; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #d97706; font-family: monospace;">{otp}</span>
                </div>
                <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin-bottom: 4px;">
                    ⏰ This code is valid for <strong>10 minutes</strong>.
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
                    If you did not request this OTP, you can safely ignore this email.
                </p>
            </div>
            """
        }).encode('utf-8')

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "api-key": brevo_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = json.loads(response.read().decode('utf-8'))
            msg_id = res_body.get('messageId')
            return {"delivered": True, "provider": "Brevo Email", "messageId": msg_id}
    except urllib.error.HTTPError as e:
        try:
            err_data = json.loads(e.read().decode('utf-8'))
            err_msg = err_data.get('message', f'HTTP {e.code}')
        except:
            err_msg = f'HTTP {e.code}: {e.reason}'
        return {"delivered": False, "provider": "Brevo Email", "error": err_msg}
    except Exception as e:
        return {"delivered": False, "provider": "Brevo Email", "error": str(e)}

def send_brevo_sms(brevo_key: str, clean_mobile: str, otp: str) -> dict:
    """
    Sends a transactional SMS using Brevo's v3 transactionalSMS API.
    Endpoint: https://api.brevo.com/v3/transactionalSMS/send
    """
    try:
        url = "https://api.brevo.com/v3/transactionalSMS/send"
        sender_name = os.environ.get('BREVO_SMS_SENDER', 'DailyWork').strip()
        # Sender must be alphanumeric and max 11 characters
        sender_name = "".join(c for c in sender_name if c.isalnum())[:11] or "DailyWork"

        recipient = f"91{clean_mobile}"
        content = f"Your DailyWork verification code is {otp}. Valid for 10 minutes."

        payload = json.dumps({
            "sender": sender_name,
            "recipient": recipient,
            "content": content,
            "type": "transactional"
        }).encode('utf-8')

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "api-key": brevo_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = json.loads(response.read().decode('utf-8'))
            msg_id = res_body.get('messageId') or res_body.get('reference')
            return {
                "delivered": True,
                "provider": "Brevo",
                "message": f"Real SMS sent via Brevo to +91 {clean_mobile} (Message ID: {msg_id})"
            }
    except urllib.error.HTTPError as e:
        try:
            err_data = json.loads(e.read().decode('utf-8'))
            err_msg = err_data.get('message', f'HTTP {e.code}')
        except:
            err_msg = f'HTTP {e.code}: {e.reason}'
        return {"delivered": False, "provider": "Brevo", "error": err_msg}
    except Exception as e:
        return {"delivered": False, "provider": "Brevo", "error": str(e)}

def send_real_otp(mobile: str, otp: str, email: str = None) -> dict:
    """
    Attempts to send a real OTP via configured providers in order of preference:
    1. Brevo (Sendinblue) SMS & Email
    2. Fast2SMS (Indian Gateway)
    3. 2Factor.in (Indian Gateway)
    4. Twilio (Global SMS)
    Falls back gracefully to Demo Simulator if none configured or if carrier fails.
    """
    load_env() # Reload in case .env was recently created or updated
    clean_mobile = mobile.replace('+91', '').replace(' ', '').strip()

    # ----------------------------------------------------
    # 1. Check Brevo (Sendinblue) API
    # ----------------------------------------------------
    brevo_key = os.environ.get('BREVO_API_KEY')
    if brevo_key and brevo_key.strip() and not brevo_key.startswith('your_brevo'):
        brevo_key = brevo_key.strip()

        # A. Attempt Brevo Transactional SMS
        sms_result = send_brevo_sms(brevo_key, clean_mobile, otp)
        
        # B. Check if Brevo Email notification is also configured
        email_target = email or os.environ.get('BREVO_EMAIL_TO')
        sender_email = os.environ.get('BREVO_SENDER_EMAIL')
        email_result = None
        if email_target:
            email_result = send_brevo_email(brevo_key, email_target, otp, sender_email)

        # Evaluate combined result
        if sms_result.get('delivered'):
            if email_result and email_result.get('delivered'):
                return {
                    "delivered": True,
                    "provider": "Brevo (SMS + Email)",
                    "message": f"SMS sent to +91 {clean_mobile} and email sent to {email_target}"
                }
            return sms_result

        # If SMS failed (e.g. no SMS credits or DLT required), but email succeeded:
        if email_result and email_result.get('delivered'):
            return {
                "delivered": True,
                "provider": "Brevo Email",
                "message": f"OTP sent to {email_target} via Brevo! (Note: SMS returned: {sms_result.get('error')})"
            }

        # If SMS failed and no email succeeded
        return {
            "delivered": False,
            "provider": "Brevo",
            "error": sms_result.get('error', 'Brevo delivery failed')
        }

    # ----------------------------------------------------
    # 2. Check Fast2SMS
    # ----------------------------------------------------
    fast2sms_key = os.environ.get('FAST2SMS_API_KEY')
    if fast2sms_key and fast2sms_key.strip() and not fast2sms_key.startswith('your_fast2sms'):
        # Check Smart OTP endpoint first if OTP template ID is configured
        smart_otp_id = os.environ.get('FAST2SMS_OTP_ID')
        if smart_otp_id:
            try:
                url = "https://www.fast2sms.com/dev/otp/send"
                payload = json.dumps({
                    "mobile": clean_mobile,
                    "otp_id": smart_otp_id,
                    "otp": otp
                }).encode('utf-8')
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={
                        "authorization": fast2sms_key.strip(),
                        "Content-Type": "application/json"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10) as response:
                    res_body = json.loads(response.read().decode('utf-8'))
                    if res_body.get('return'):
                        return {
                            "delivered": True,
                            "provider": "Fast2SMS (Smart OTP)",
                            "message": f"Real SMS sent to +91 {clean_mobile}"
                        }
            except Exception as e:
                print(f"Fast2SMS Smart OTP error: {e}")

        # Fallback to bulkV2 route
        try:
            url = "https://www.fast2sms.com/dev/bulkV2"
            payload = json.dumps({
                "variables_values": otp,
                "route": "otp",
                "numbers": clean_mobile
            }).encode('utf-8')

            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "authorization": fast2sms_key.strip(),
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = json.loads(response.read().decode('utf-8'))
                if res_body.get('return'):
                    return {
                        "delivered": True,
                        "provider": "Fast2SMS",
                        "message": f"Real SMS sent to +91 {clean_mobile}"
                    }
                else:
                    return {
                        "delivered": False,
                        "provider": "Fast2SMS",
                        "error": str(res_body.get('message', 'Fast2SMS returned an error'))
                    }
        except urllib.error.HTTPError as e:
            try:
                err_data = json.loads(e.read().decode('utf-8'))
                err_msg = err_data.get('message', f'HTTP {e.code}')
            except:
                err_msg = f'HTTP {e.code}: {e.reason}'
            return {"delivered": False, "provider": "Fast2SMS", "error": err_msg}
        except Exception as e:
            return {"delivered": False, "provider": "Fast2SMS", "error": str(e)}

    # ----------------------------------------------------
    # 3. Check 2Factor.in
    # ----------------------------------------------------
    twofactor_key = os.environ.get('TWOFACTOR_API_KEY')
    if twofactor_key and twofactor_key.strip() and not twofactor_key.startswith('your_2factor'):
        try:
            url = f"https://2factor.in/v1/API/SMS/{twofactor_key.strip()}/SMS/{clean_mobile}/{otp}/DailyWork"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = json.loads(response.read().decode('utf-8'))
                if res_body.get('Status') == 'Success':
                    return {
                        "delivered": True,
                        "provider": "2Factor",
                        "message": f"Real SMS sent to +91 {clean_mobile}"
                    }
                else:
                    return {
                        "delivered": False,
                        "provider": "2Factor",
                        "error": str(res_body.get('Details', 'Error from 2Factor'))
                    }
        except Exception as e:
            return {"delivered": False, "provider": "2Factor", "error": str(e)}

    # ----------------------------------------------------
    # 4. Check Twilio
    # ----------------------------------------------------
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_PHONE_NUMBER')

    if account_sid and auth_token and from_number:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
            to_number = f"+91{clean_mobile}" if not clean_mobile.startswith('+') else clean_mobile
            body_text = f"Your DailyWork verification code is {otp}. Valid for 10 minutes."

            post_data = urllib.parse.urlencode({
                "To": to_number,
                "From": from_number,
                "Body": body_text
            }).encode('utf-8')

            auth_str = f"{account_sid}:{auth_token}"
            b64_auth = base64.b64encode(auth_str.encode('ascii')).decode('ascii')

            req = urllib.request.Request(
                url,
                data=post_data,
                headers={"Authorization": f"Basic {b64_auth}"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                return {
                    "delivered": True,
                    "provider": "Twilio",
                    "message": f"Real SMS sent via Twilio to {to_number}"
                }
        except Exception as e:
            return {"delivered": False, "provider": "Twilio", "error": str(e)}

    # Fallback to demo simulator mode
    return {
        "delivered": False,
        "provider": "demo_simulator",
        "message": "Running in simulator mode. Configure BREVO_API_KEY in .env for real OTP delivery."
    }
