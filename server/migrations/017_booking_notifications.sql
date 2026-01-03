-- =====================================================================
-- UNIFIED NOTIFICATION SYSTEM FOR ALL RENTALS
-- Same flow: Book → Email → Reminders → Checkout gate
-- =====================================================================

-- =====================================================================
-- 1. BOOKING NOTIFICATIONS TABLE
-- Tracks all emails sent for any booking type
-- =====================================================================

CREATE TABLE IF NOT EXISTS cc_booking_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    booking_type TEXT NOT NULL CHECK (booking_type IN ('equipment', 'accommodation')),
    booking_id UUID NOT NULL,
    
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'confirmation',
        'waiver_reminder_7day',
        'waiver_reminder_3day',
        'waiver_reminder_1day',
        'waiver_completed',
        'checkin_ready',
        'checkin_reminder',
        'checkout_reminder',
        'review_request'
    )),
    
    recipient_individual_id UUID REFERENCES cc_individuals(id),
    recipient_email TEXT NOT NULL,
    recipient_name TEXT DEFAULT '',
    
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    waiver_signed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_notifications_booking ON cc_booking_notifications(booking_type, booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_scheduled ON cc_booking_notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_booking_notifications_type ON cc_booking_notifications(notification_type);

-- =====================================================================
-- 2. ADD CHECKOUT GATE FIELDS TO BOOKINGS
-- =====================================================================

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS waiver_signed BOOLEAN DEFAULT false;

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS waiver_signed_at TIMESTAMPTZ;

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS waiver_signed_id UUID REFERENCES cc_signed_waivers(id);

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS waiver_valid BOOLEAN DEFAULT false;

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS confirmation_email_sent BOOLEAN DEFAULT false;

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS waiver_link_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex');

-- =====================================================================
-- 3. FUNCTION: Schedule notifications for new booking
-- =====================================================================

CREATE OR REPLACE FUNCTION schedule_booking_notifications(
    p_booking_type TEXT,
    p_booking_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_individual_id UUID;
    v_email TEXT;
    v_name TEXT;
    v_item_name TEXT;
    v_start_time TIMESTAMPTZ;
    v_waiver_required TEXT;
    v_waiver_token TEXT;
    v_notifications_created INTEGER := 0;
BEGIN
    IF p_booking_type = 'equipment' THEN
        SELECT 
            b.renter_individual_id,
            i.email,
            i.full_name,
            ri.name,
            b.starts_at,
            COALESCE(ri.waiver_requirement, 'at_checkout'),
            b.waiver_link_token
        INTO 
            v_individual_id, v_email, v_name, v_item_name, 
            v_start_time, v_waiver_required, v_waiver_token
        FROM cc_rental_bookings b
        JOIN cc_individuals i ON i.id = b.renter_individual_id
        JOIN cc_rental_items ri ON ri.id = b.rental_item_id
        WHERE b.id = p_booking_id;
        
    ELSIF p_booking_type = 'accommodation' THEN
        SELECT 
            ab.guest_individual_id,
            i.email,
            i.full_name,
            ap.name,
            ab.check_in_date::timestamptz,
            'before_checkin',
            encode(gen_random_bytes(32), 'hex')
        INTO 
            v_individual_id, v_email, v_name, v_item_name, 
            v_start_time, v_waiver_required, v_waiver_token
        FROM accommodation_bookings ab
        JOIN cc_individuals i ON i.id = ab.guest_individual_id
        JOIN accommodation_properties ap ON ap.id = ab.property_id
        WHERE ab.id = p_booking_id;
    END IF;
    
    IF v_waiver_required = 'none' THEN
        INSERT INTO cc_booking_notifications (
            booking_type, booking_id, notification_type,
            recipient_individual_id, recipient_email, recipient_name,
            subject, scheduled_for
        ) VALUES (
            p_booking_type, p_booking_id, 'confirmation',
            v_individual_id, v_email, v_name,
            'Booking Confirmed: ' || v_item_name,
            NOW()
        );
        RETURN 1;
    END IF;
    
    INSERT INTO cc_booking_notifications (
        booking_type, booking_id, notification_type,
        recipient_individual_id, recipient_email, recipient_name,
        subject, scheduled_for
    ) VALUES (
        p_booking_type, p_booking_id, 'confirmation',
        v_individual_id, v_email, v_name,
        'Booking Confirmed: ' || v_item_name || ' - Please Sign Waiver',
        NOW()
    );
    v_notifications_created := v_notifications_created + 1;
    
    IF v_start_time > NOW() + INTERVAL '7 days' THEN
        INSERT INTO cc_booking_notifications (
            booking_type, booking_id, notification_type,
            recipient_individual_id, recipient_email, recipient_name,
            subject, scheduled_for
        ) VALUES (
            p_booking_type, p_booking_id, 'waiver_reminder_7day',
            v_individual_id, v_email, v_name,
            'Reminder: Sign Waiver for ' || v_item_name || ' (7 days)',
            v_start_time - INTERVAL '7 days'
        );
        v_notifications_created := v_notifications_created + 1;
    END IF;
    
    IF v_start_time > NOW() + INTERVAL '3 days' THEN
        INSERT INTO cc_booking_notifications (
            booking_type, booking_id, notification_type,
            recipient_individual_id, recipient_email, recipient_name,
            subject, scheduled_for
        ) VALUES (
            p_booking_type, p_booking_id, 'waiver_reminder_3day',
            v_individual_id, v_email, v_name,
            'Reminder: Sign Waiver for ' || v_item_name || ' (3 days)',
            v_start_time - INTERVAL '3 days'
        );
        v_notifications_created := v_notifications_created + 1;
    END IF;
    
    IF v_start_time > NOW() + INTERVAL '1 day' THEN
        INSERT INTO cc_booking_notifications (
            booking_type, booking_id, notification_type,
            recipient_individual_id, recipient_email, recipient_name,
            subject, scheduled_for
        ) VALUES (
            p_booking_type, p_booking_id, 'waiver_reminder_1day',
            v_individual_id, v_email, v_name,
            'Action Required: Sign Waiver for ' || v_item_name || ' (Tomorrow!)',
            v_start_time - INTERVAL '1 day'
        );
        v_notifications_created := v_notifications_created + 1;
    END IF;
    
    RETURN v_notifications_created;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 4. TRIGGER: Auto-schedule notifications on new booking
-- =====================================================================

CREATE OR REPLACE FUNCTION trigger_schedule_rental_notifications()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM schedule_booking_notifications('equipment', NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rental_booking_notifications ON cc_rental_bookings;
CREATE TRIGGER trg_rental_booking_notifications
    AFTER INSERT ON cc_rental_bookings
    FOR EACH ROW
    WHEN (NEW.status IN ('pending', 'confirmed'))
    EXECUTE FUNCTION trigger_schedule_rental_notifications();

-- =====================================================================
-- 5. FUNCTION: Cancel pending notifications when waiver signed
-- =====================================================================

CREATE OR REPLACE FUNCTION cancel_waiver_reminders(
    p_booking_type TEXT,
    p_booking_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE cc_booking_notifications
    SET status = 'skipped'
    WHERE booking_type = p_booking_type
    AND booking_id = p_booking_id
    AND notification_type LIKE 'waiver_reminder%'
    AND status = 'pending';
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    INSERT INTO cc_booking_notifications (
        booking_type, booking_id, notification_type,
        recipient_individual_id, recipient_email, recipient_name,
        subject, scheduled_for
    )
    SELECT 
        p_booking_type, 
        p_booking_id, 
        'waiver_completed',
        recipient_individual_id,
        recipient_email,
        recipient_name,
        'Waiver Signed - You''re All Set!',
        NOW()
    FROM cc_booking_notifications
    WHERE booking_type = p_booking_type
    AND booking_id = p_booking_id
    AND notification_type = 'confirmation'
    LIMIT 1;
    
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 6. VIEW: Pending notifications to send
-- =====================================================================

DROP VIEW IF EXISTS v_pending_notifications;
CREATE VIEW v_pending_notifications AS
SELECT 
    n.*,
    
    CASE 
        WHEN n.booking_type = 'equipment' THEN (
            SELECT waiver_signed FROM cc_rental_bookings WHERE id = n.booking_id
        )
        ELSE false
    END as waiver_already_signed,
    
    CASE 
        WHEN n.booking_type = 'equipment' THEN (
            SELECT ri.name FROM cc_rental_bookings b 
            JOIN cc_rental_items ri ON ri.id = b.rental_item_id 
            WHERE b.id = n.booking_id
        )
        ELSE NULL
    END as item_name,
    
    CASE 
        WHEN n.booking_type = 'equipment' THEN (
            SELECT waiver_link_token FROM cc_rental_bookings WHERE id = n.booking_id
        )
        ELSE NULL
    END as waiver_token

FROM cc_booking_notifications n
WHERE n.status = 'pending'
AND n.scheduled_for <= NOW()
ORDER BY n.scheduled_for;

-- =====================================================================
-- 7. VIEW: Checkout gate status
-- =====================================================================

DROP VIEW IF EXISTS v_rental_checkout_gate;
CREATE VIEW v_rental_checkout_gate AS
SELECT 
    b.id as booking_id,
    b.status,
    b.starts_at,
    b.ends_at,
    i.full_name as renter_name,
    i.email as renter_email,
    ri.name as item_name,
    ri.location_name,
    rc.name as category,
    
    ri.waiver_requirement,
    rc.required_waiver_slug,
    b.waiver_signed,
    b.waiver_signed_at,
    
    CASE
        WHEN ri.waiver_requirement = 'none' THEN true
        WHEN b.waiver_signed THEN true
        WHEN b.waiver_valid THEN true
        ELSE false
    END as can_checkout,
    
    CASE
        WHEN ri.waiver_requirement = 'none' THEN NULL
        WHEN b.waiver_signed OR b.waiver_valid THEN NULL
        ELSE 'Waiver not signed'
    END as checkout_blocker,
    
    CASE
        WHEN b.starts_at < NOW() AND NOT (b.waiver_signed OR b.waiver_valid OR ri.waiver_requirement = 'none') 
        THEN 'overdue'
        WHEN b.starts_at < NOW() + INTERVAL '1 day' AND NOT (b.waiver_signed OR b.waiver_valid OR ri.waiver_requirement = 'none')
        THEN 'urgent'
        WHEN b.starts_at < NOW() + INTERVAL '3 days' AND NOT (b.waiver_signed OR b.waiver_valid OR ri.waiver_requirement = 'none')
        THEN 'soon'
        ELSE 'ok'
    END as time_pressure,
    
    b.waiver_link_token

FROM cc_rental_bookings b
JOIN cc_individuals i ON i.id = b.renter_individual_id
JOIN cc_rental_items ri ON ri.id = b.rental_item_id
JOIN cc_rental_categories rc ON rc.id = ri.category_id
WHERE b.status IN ('pending', 'confirmed', 'active', 'checked_out');

-- =====================================================================
-- 8. FUNCTION: Mark waiver signed for booking
-- =====================================================================

CREATE OR REPLACE FUNCTION sign_waiver_for_booking(
    p_booking_id UUID,
    p_signed_waiver_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE cc_rental_bookings
    SET 
        waiver_signed = true,
        waiver_signed_at = NOW(),
        waiver_signed_id = p_signed_waiver_id
    WHERE id = p_booking_id;
    
    PERFORM cancel_waiver_reminders('equipment', p_booking_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 9. VIEW: Notification stats for admin
-- =====================================================================

DROP VIEW IF EXISTS v_notification_stats;
CREATE VIEW v_notification_stats AS
SELECT 
    notification_type,
    status,
    COUNT(*) as count,
    MIN(scheduled_for) as earliest,
    MAX(scheduled_for) as latest
FROM cc_booking_notifications
GROUP BY notification_type, status
ORDER BY notification_type, status;
