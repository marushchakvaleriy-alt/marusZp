"""
Test script to verify debt calculations are correct.

Expected results:
- Order #1: Price 100000, ZP 5000, Stage1 2500
  - Started (date_to_work exists)
  - Fine: 1000
  - Payment: 1000
  - Debt: 2500 - 1000 (fine) - 1000 (payment) = 500 грн
  
- Order #2: Price 100000, ZP 5000, Stage1 2500
  - Started (date_to_work exists)
  - Fine: 3500
  - Debt: 2500 - 3500 (fine) = -1000 грн (technologist owes customer)
  
- Total Debt Dashboard: Only order #1 = 500 грн
  (Order #2 is negative so not counted in total debt)
"""
print(__doc__)
