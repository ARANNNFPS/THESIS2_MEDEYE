#!/usr/bin/env python3
"""
Script to update the database with all medicines from pills.csv
"""

import sqlite3
import csv
import os

# Paths
DB_PATH = 'assets/mediweb.db'
CSV_PATH = 'assets/pills.csv'

def update_database():
    """Import all medicines from CSV to database"""

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute("DELETE FROM pills")
    print("Cleared existing medicines from database")

    # Read CSV and insert data (with BOM handling)
    with open(CSV_PATH, 'r', encoding='utf-8-sig') as csvfile:
        csv_reader = csv.DictReader(csvfile)

        medicines_added = 0
        for row in csv_reader:
            cursor.execute("""
                INSERT INTO pills (
                    ID, Pill_Label, Generic_Name, Brand_Name, Manufacturer,
                    Medical_Use, Dosage_Guidelines, Warnings, Additional_Info,
                    Prescription_Req, Legal_Status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row['ID'],
                row['Pill_Label'],
                row['Generic_Name'],
                row['Brand_Name'],
                row['Manufacturer'],
                row['Medical_Use'],
                row['Dosage_Guidelines'],
                row['Warnings'],
                row['Additional_Info'],
                row['Prescription_Req'],
                row['Legal_Status']
            ))
            medicines_added += 1
            print(f"Added: {row['Pill_Label']}")

    # Commit changes
    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM pills")
    count = cursor.fetchone()[0]
    print(f"\n✓ Successfully added {medicines_added} medicines to database")
    print(f"✓ Database now contains {count} medicines")

    # List all medicines
    print("\nMedicines in database:")
    cursor.execute("SELECT ID, Pill_Label FROM pills ORDER BY ID")
    for row in cursor.fetchall():
        print(f"  {row[0]}. {row[1]}")

    conn.close()

if __name__ == '__main__':
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        exit(1)

    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV file not found at {CSV_PATH}")
        exit(1)

    print("Updating database with medicines from CSV...\n")
    update_database()
    print("\n✓ Database update complete!")
