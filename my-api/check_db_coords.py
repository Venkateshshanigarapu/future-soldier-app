
import psycopg2
import sys

def check_db():
    try:
        # Try defaults from db.js
        conn = psycopg2.connect(
            user="postgres",
            password="123456",
            host="117.251.19.107",
            port=5432,
            database="future_soldier"
        )
        cur = conn.cursor()
        print("Checking users table in future_soldier database...")
        cur.execute("SELECT username, latitude, longitude FROM users WHERE latitude IS NOT NULL LIMIT 10;")
        rows = cur.fetchall()
        for row in rows:
            print(f"User: {row[0]}, Lat: {row[1]}, Lng: {row[2]}")
        
        if not rows:
            print("No users with valid latitude found.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error checking future_soldier: {e}")
        try:
            conn = psycopg2.connect(
                user="postgres",
                password="123456",
                host="117.251.19.107",
                port=5432,
                database="OCFA"
            )
            cur = conn.cursor()
            print("Checking users table in OCFA database...")
            cur.execute("SELECT username, latitude, longitude FROM users WHERE latitude IS NOT NULL LIMIT 10;")
            rows = cur.fetchall()
            for row in rows:
                print(f"User: {row[0]}, Lat: {row[1]}, Lng: {row[2]}")
            cur.close()
            conn.close()
        except Exception as e2:
            print(f"Error checking OCFA: {e2}")

if __name__ == "__main__":
    check_db()
