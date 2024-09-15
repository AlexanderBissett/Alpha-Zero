import requests
import json
import time
from datetime import datetime

def yesterday():
    now = time.time()
    yday = time.localtime(now - 3000) # seconds/day
    start = time.struct_time((yday.tm_year, yday.tm_mon, yday.tm_mday, 0, 0, 0, 0, 0, yday.tm_isdst))
    today = time.localtime(now)
    end = time.struct_time((today.tm_year, today.tm_mon, today.tm_mday, 0, 0, 0, 0, 0, today.tm_isdst))
    return time.mktime(start), time.mktime(end)

yest,_=yesterday()
iyest=int(yest)

url = "https://graph.defined.fi/graphql"

MY_KEY = ""

headers = {
  "content_type":"application/json",
  "Authorization": MY_KEY,
}

gCall = f"""{{
  filterTokens(
    filters: {{
      createdAt : {{ gte: {iyest} }}
      volume1: {{gte: 10000}}
      liquidity: {{gte: 5000}}
      network: [1399811149]
    }}
    limit: 100
  ) {{
    results {{
      volume1
      liquidity
      marketCap
      priceUSD
      exchanges {{
        name
      }}
      token {{
        address
        name
        networkId
        symbol
      }}
    }}
  }}
}}"""

while True:
    response = requests.post(url, headers=headers, json={"query": gCall})
    result = json.loads(response.text)
    #print(result)

    # ----------------------------------------------------------------------------------------

    print('='*88)
    res_clean = result["data"]["filterTokens"]["results"]
    print(len(res_clean))
    # print(res_clean)
    # print(len(res_clean))
    for el in res_clean:
      for key, val in el.items():
        print (f"{key} : {val}")
      print('-'*88)
    print('='*88)
    time.sleep(1200)
