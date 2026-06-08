import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingExclusionConstraint1780963200000 implements MigrationInterface {
  name = 'AddBookingExclusionConstraint1780963200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Required for mixing scalar types (uuid) with range types (tstzrange) in a GiST index
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // Prevent double-booking at the database level.
    // The partial index (WHERE active + not deleted) means:
    //  - Cancelled bookings are excluded → the same slot can be re-booked after cancellation.
    //  - '[)' (inclusive start, exclusive end) → back-to-back bookings are allowed.
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD CONSTRAINT "no_double_booking"
        EXCLUDE USING GIST (
          location_id                             WITH =,
          tstzrange(start_time, end_time, '[)')   WITH &&
        )
        WHERE (status = 'active' AND deleted_at IS NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "no_double_booking"`,
    );
    // btree_gist is intentionally not dropped — other objects may depend on it
  }
}
