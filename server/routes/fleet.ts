import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function createFleetRouter(db: Pool) {
  const router = Router();

  // =====================================================
  // FLEET VEHICLES
  // =====================================================

  router.get('/vehicles', async (req: Request, res: Response) => {
    try {
      const { status, assigned_to } = req.query;
      
      let query = `
        SELECT v.*, 
               p.name as assigned_to_display_name,
               (SELECT COUNT(*) FROM vehicle_photos WHERE vehicle_id = v.id) as photo_count,
               (SELECT COUNT(*) FROM vehicle_safety_equipment WHERE vehicle_id = v.id AND present = true) as equipment_count
        FROM vehicle_profiles v
        LEFT JOIN participant_profiles p ON v.assigned_to_id = p.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;
      
      if (status) {
        params.push(status);
        query += ` AND v.fleet_status = $${paramIndex++}`;
      }
      
      if (assigned_to) {
        params.push(assigned_to);
        query += ` AND v.assigned_to_id = $${paramIndex++}`;
      }
      
      query += ' ORDER BY v.fleet_number, v.nickname, v.make, v.model';
      
      const result = await db.query(query, params);
      res.json({ vehicles: result.rows });
    } catch (error) {
      console.error('Error fetching fleet vehicles:', error);
      res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
  });

  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const vehicleStats = await db.query(`
        SELECT 
          COUNT(*) as total_vehicles,
          COUNT(*) FILTER (WHERE fleet_status = 'available') as available,
          COUNT(*) FILTER (WHERE fleet_status = 'in_use') as in_use,
          COUNT(*) FILTER (WHERE fleet_status = 'maintenance') as maintenance,
          COUNT(*) FILTER (WHERE fleet_status = 'reserved') as reserved,
          COUNT(*) FILTER (WHERE fleet_status = 'retired') as retired
        FROM vehicle_profiles
      `);
      
      const trailerStats = await db.query(`
        SELECT 
          COUNT(*) as total_trailers,
          COUNT(*) FILTER (WHERE fleet_status = 'available') as available,
          COUNT(*) FILTER (WHERE fleet_status = 'in_use') as in_use,
          COUNT(*) FILTER (WHERE fleet_status = 'maintenance') as maintenance
        FROM trailer_profiles
      `);
      
      res.json({
        vehicles: vehicleStats.rows[0],
        trailers: trailerStats.rows[0]
      });
    } catch (error) {
      console.error('Error fetching fleet stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  router.post('/vehicles', async (req: Request, res: Response) => {
    try {
      const {
        nickname, fleet_number, year, make, model, color,
        license_plate, vin, vehicle_class, drive_type, fuel_type,
        ground_clearance_inches, length_feet, height_feet, passenger_capacity,
        towing_capacity_lbs, has_hitch, hitch_class, hitch_ball_size,
        has_brake_controller, trailer_wiring, has_gooseneck_hitch, has_fifth_wheel_hitch,
        fleet_status
      } = req.body;
      
      const result = await db.query(`
        INSERT INTO vehicle_profiles (
          owner_type, nickname, fleet_number, year, make, model, color,
          license_plate, vin, vehicle_class, drive_type, fuel_type,
          ground_clearance_inches, length_feet, height_feet, passenger_capacity,
          towing_capacity_lbs, has_hitch, hitch_class, hitch_ball_size,
          has_brake_controller, trailer_wiring, has_gooseneck_hitch, has_fifth_wheel_hitch,
          fleet_status, is_fleet_vehicle
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        RETURNING *
      `, [
        'company', nickname || null, fleet_number || null, year || null, make, model, color || null,
        license_plate || null, vin || null, vehicle_class || 'truck', drive_type || '4wd', fuel_type || 'gas',
        ground_clearance_inches || null, length_feet || null, height_feet || null, passenger_capacity || null,
        towing_capacity_lbs || null, has_hitch || false, hitch_class || null, hitch_ball_size || null,
        has_brake_controller || false, trailer_wiring || null, has_gooseneck_hitch || false, has_fifth_wheel_hitch || false,
        fleet_status || 'available', true
      ]);
      
      res.json({ vehicle: result.rows[0] });
    } catch (error) {
      console.error('Error creating fleet vehicle:', error);
      res.status(500).json({ error: 'Failed to create vehicle' });
    }
  });

  router.patch('/vehicles/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nickname, fleet_number, fleet_status, assigned_to_id, assigned_to_name, primary_photo_url } = req.body;
      
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (nickname !== undefined) {
        updates.push(`nickname = $${paramIndex++}`);
        params.push(nickname);
      }
      if (fleet_number !== undefined) {
        updates.push(`fleet_number = $${paramIndex++}`);
        params.push(fleet_number);
      }
      if (fleet_status !== undefined) {
        updates.push(`fleet_status = $${paramIndex++}`);
        params.push(fleet_status);
        
        if (fleet_status === 'in_use') {
          updates.push(`last_check_out = NOW()`);
        } else if (fleet_status === 'available') {
          updates.push(`last_check_in = NOW()`);
        }
      }
      if (assigned_to_id !== undefined) {
        updates.push(`assigned_to_id = $${paramIndex++}`);
        params.push(assigned_to_id || null);
      }
      if (assigned_to_name !== undefined) {
        updates.push(`assigned_to_name = $${paramIndex++}`);
        params.push(assigned_to_name);
      }
      if (primary_photo_url !== undefined) {
        updates.push(`primary_photo_url = $${paramIndex++}`);
        params.push(primary_photo_url);
      }
      
      updates.push(`updated_at = NOW()`);
      
      params.push(id);
      
      const result = await db.query(`
        UPDATE vehicle_profiles 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating vehicle:', error);
      res.status(500).json({ error: 'Failed to update vehicle' });
    }
  });

  router.patch('/vehicles/:id/hitch', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        has_hitch, hitch_class, hitch_ball_size, 
        has_gooseneck_hitch, has_fifth_wheel_hitch, 
        has_brake_controller, trailer_wiring 
      } = req.body;
      
      const result = await db.query(`
        UPDATE vehicle_profiles 
        SET has_hitch = $1, hitch_class = $2, hitch_ball_size = $3,
            has_gooseneck_hitch = $4, has_fifth_wheel_hitch = $5,
            has_brake_controller = $6, trailer_wiring = $7,
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `, [has_hitch, hitch_class, hitch_ball_size, has_gooseneck_hitch, has_fifth_wheel_hitch, has_brake_controller, trailer_wiring, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating hitch config:', error);
      res.status(500).json({ error: 'Failed to update hitch configuration' });
    }
  });

  // =====================================================
  // VEHICLE PHOTOS
  // =====================================================

  router.get('/vehicles/:id/photos', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM vehicle_photos WHERE vehicle_id = $1 ORDER BY photo_order, created_at',
        [id]
      );
      res.json({ photos: result.rows });
    } catch (error) {
      console.error('Error fetching photos:', error);
      res.status(500).json({ error: 'Failed to fetch photos' });
    }
  });

  router.post('/vehicles/:id/photos', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { photo_type, photo_url, thumbnail_url, caption, photo_order } = req.body;
      
      const result = await db.query(`
        INSERT INTO vehicle_photos (vehicle_id, photo_type, photo_url, thumbnail_url, caption, photo_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [id, photo_type, photo_url, thumbnail_url || null, caption || null, photo_order || 0]);
      
      if (photo_type === 'primary') {
        await db.query(
          'UPDATE vehicle_profiles SET primary_photo_url = $1 WHERE id = $2',
          [photo_url, id]
        );
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error adding photo:', error);
      res.status(500).json({ error: 'Failed to add photo' });
    }
  });

  router.delete('/vehicles/:vehicleId/photos/:photoId', async (req: Request, res: Response) => {
    try {
      const { vehicleId, photoId } = req.params;
      await db.query(
        'DELETE FROM vehicle_photos WHERE id = $1 AND vehicle_id = $2',
        [photoId, vehicleId]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting photo:', error);
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  });

  // =====================================================
  // TRAILERS
  // =====================================================

  router.get('/trailers', async (req: Request, res: Response) => {
    try {
      const { status, type } = req.query;
      
      let query = `
        SELECT t.*, 
               v.nickname as hitched_to_nickname,
               v.fleet_number as hitched_to_fleet_number,
               (SELECT COUNT(*) FROM trailer_photos WHERE trailer_id = t.id) as photo_count
        FROM trailer_profiles t
        LEFT JOIN vehicle_profiles v ON t.currently_hitched_to = v.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;
      
      if (status) {
        params.push(status);
        query += ` AND t.fleet_status = $${paramIndex++}`;
      }
      
      if (type) {
        params.push(type);
        query += ` AND t.trailer_type = $${paramIndex++}`;
      }
      
      query += ' ORDER BY t.fleet_number, t.nickname';
      
      const result = await db.query(query, params);
      res.json({ trailers: result.rows });
    } catch (error) {
      console.error('Error fetching trailers:', error);
      res.status(500).json({ error: 'Failed to fetch trailers' });
    }
  });

  router.post('/trailers', async (req: Request, res: Response) => {
    try {
      const {
        nickname, fleet_number, owner_type, trailer_type,
        length_feet, width_feet, height_feet,
        interior_length_feet, interior_width_feet, interior_height_feet,
        gvwr_lbs, empty_weight_lbs, payload_capacity_lbs,
        hitch_type, required_ball_size, tongue_weight_lbs,
        brake_type, wiring_type, gate_type, has_side_door,
        has_tie_downs, tie_down_count, floor_type, color,
        license_plate, registration_expiry, notes
      } = req.body;
      
      const result = await db.query(`
        INSERT INTO trailer_profiles (
          nickname, fleet_number, owner_type, trailer_type,
          length_feet, width_feet, height_feet,
          interior_length_feet, interior_width_feet, interior_height_feet,
          gvwr_lbs, empty_weight_lbs, payload_capacity_lbs,
          hitch_type, required_ball_size, tongue_weight_lbs,
          brake_type, wiring_type, gate_type, has_side_door,
          has_tie_downs, tie_down_count, floor_type, color,
          license_plate, registration_expiry, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        RETURNING *
      `, [
        nickname, fleet_number, owner_type || 'company', trailer_type,
        length_feet, width_feet, height_feet,
        interior_length_feet, interior_width_feet, interior_height_feet,
        gvwr_lbs, empty_weight_lbs, payload_capacity_lbs,
        hitch_type || 'ball', required_ball_size, tongue_weight_lbs,
        brake_type || 'none', wiring_type || '4_pin', gate_type, has_side_door,
        has_tie_downs, tie_down_count, floor_type, color,
        license_plate, registration_expiry, notes
      ]);
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating trailer:', error);
      res.status(500).json({ error: 'Failed to create trailer' });
    }
  });

  router.get('/trailers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await db.query(`
        SELECT t.*, 
               v.nickname as hitched_to_nickname,
               v.fleet_number as hitched_to_fleet_number,
               v.make as hitched_to_make,
               v.model as hitched_to_model
        FROM trailer_profiles t
        LEFT JOIN vehicle_profiles v ON t.currently_hitched_to = v.id
        WHERE t.id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Trailer not found' });
      }
      
      const photos = await db.query(
        'SELECT * FROM trailer_photos WHERE trailer_id = $1 ORDER BY photo_order',
        [id]
      );
      
      res.json({ 
        ...result.rows[0],
        photos: photos.rows
      });
    } catch (error) {
      console.error('Error fetching trailer:', error);
      res.status(500).json({ error: 'Failed to fetch trailer' });
    }
  });

  router.patch('/trailers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const fields = Object.keys(updates).filter(k => updates[k] !== undefined);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      const values = fields.map(f => updates[f]);
      values.push(id);
      
      const result = await db.query(`
        UPDATE trailer_profiles 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Trailer not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating trailer:', error);
      res.status(500).json({ error: 'Failed to update trailer' });
    }
  });

  router.post('/trailers/:id/hitch', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { vehicle_id } = req.body;
      
      const trailerResult = await db.query('SELECT * FROM trailer_profiles WHERE id = $1', [id]);
      if (trailerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trailer not found' });
      }
      const trailer = trailerResult.rows[0];
      
      const vehicleResult = await db.query('SELECT * FROM vehicle_profiles WHERE id = $1', [vehicle_id]);
      if (vehicleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      const vehicle = vehicleResult.rows[0];
      
      const issues: string[] = [];
      const warnings: string[] = [];
      
      if (trailer.gvwr_lbs && vehicle.towing_capacity_lbs && trailer.gvwr_lbs > vehicle.towing_capacity_lbs) {
        issues.push(`Trailer GVWR (${trailer.gvwr_lbs} lbs) exceeds vehicle towing capacity (${vehicle.towing_capacity_lbs} lbs)`);
      }
      
      if (trailer.hitch_type === 'gooseneck' && !vehicle.has_gooseneck_hitch) {
        issues.push('Trailer requires gooseneck hitch');
      }
      if (trailer.hitch_type === 'fifth_wheel' && !vehicle.has_fifth_wheel_hitch) {
        issues.push('Trailer requires fifth wheel hitch');
      }
      
      if (trailer.hitch_type === 'ball' && trailer.required_ball_size && vehicle.hitch_ball_size !== trailer.required_ball_size) {
        if (vehicle.hitch_ball_size) {
          warnings.push(`Ball size mismatch: vehicle has ${vehicle.hitch_ball_size}", trailer needs ${trailer.required_ball_size}"`);
        } else {
          issues.push(`Trailer requires ${trailer.required_ball_size}" ball hitch`);
        }
      }
      
      if (trailer.brake_type === 'electric' && !vehicle.has_brake_controller) {
        issues.push('Trailer has electric brakes - vehicle needs brake controller');
      }
      
      if (trailer.wiring_type === '7_pin' && vehicle.trailer_wiring === '4_pin') {
        warnings.push('May need wiring adapter (trailer is 7-pin, vehicle is 4-pin)');
      }
      
      if (issues.length > 0) {
        return res.status(400).json({ 
          error: 'Compatibility issues',
          compatible: false,
          issues,
          warnings
        });
      }
      
      await db.query(
        'UPDATE trailer_profiles SET currently_hitched_to = $1, fleet_status = $2 WHERE id = $3',
        [vehicle_id, 'in_use', id]
      );
      
      res.json({ 
        success: true, 
        compatible: true,
        warnings,
        message: `Trailer "${trailer.nickname || trailer.fleet_number}" hitched to "${vehicle.nickname || vehicle.fleet_number}"`
      });
    } catch (error) {
      console.error('Error hitching trailer:', error);
      res.status(500).json({ error: 'Failed to hitch trailer' });
    }
  });

  router.post('/trailers/:id/unhitch', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      await db.query(
        'UPDATE trailer_profiles SET currently_hitched_to = NULL, fleet_status = $1 WHERE id = $2',
        ['available', id]
      );
      
      res.json({ success: true, message: 'Trailer unhitched' });
    } catch (error) {
      console.error('Error unhitching trailer:', error);
      res.status(500).json({ error: 'Failed to unhitch trailer' });
    }
  });

  router.post('/compatibility-check', async (req: Request, res: Response) => {
    try {
      const { vehicle_id, trailer_id } = req.body;
      
      const trailerResult = await db.query('SELECT * FROM trailer_profiles WHERE id = $1', [trailer_id]);
      const vehicleResult = await db.query('SELECT * FROM vehicle_profiles WHERE id = $1', [vehicle_id]);
      
      if (trailerResult.rows.length === 0 || vehicleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle or trailer not found' });
      }
      
      const trailer = trailerResult.rows[0];
      const vehicle = vehicleResult.rows[0];
      
      const issues: string[] = [];
      const warnings: string[] = [];
      
      if (trailer.gvwr_lbs && vehicle.towing_capacity_lbs && trailer.gvwr_lbs > vehicle.towing_capacity_lbs) {
        issues.push(`Trailer GVWR (${trailer.gvwr_lbs} lbs) exceeds vehicle towing capacity (${vehicle.towing_capacity_lbs} lbs)`);
      }
      
      if (trailer.hitch_type === 'gooseneck' && !vehicle.has_gooseneck_hitch) {
        issues.push('Trailer requires gooseneck hitch');
      }
      
      if (trailer.hitch_type === 'fifth_wheel' && !vehicle.has_fifth_wheel_hitch) {
        issues.push('Trailer requires fifth wheel hitch');
      }
      
      if (trailer.hitch_type === 'ball' && trailer.required_ball_size && vehicle.hitch_ball_size !== trailer.required_ball_size) {
        if (vehicle.hitch_ball_size) {
          warnings.push(`Ball size mismatch: vehicle has ${vehicle.hitch_ball_size}", trailer needs ${trailer.required_ball_size}"`);
        } else {
          warnings.push(`Unknown vehicle ball size - trailer needs ${trailer.required_ball_size}"`);
        }
      }
      
      if (trailer.brake_type === 'electric' && !vehicle.has_brake_controller) {
        issues.push('Trailer has electric brakes - vehicle needs brake controller');
      }
      
      if (trailer.wiring_type === '7_pin' && vehicle.trailer_wiring === '4_pin') {
        warnings.push('May need wiring adapter');
      }
      
      res.json({
        compatible: issues.length === 0,
        issues,
        warnings,
        vehicle: { id: vehicle.id, name: vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}` },
        trailer: { id: trailer.id, name: trailer.nickname || trailer.fleet_number }
      });
    } catch (error) {
      console.error('Error checking compatibility:', error);
      res.status(500).json({ error: 'Failed to check compatibility' });
    }
  });

  return router;
}

export default createFleetRouter;
