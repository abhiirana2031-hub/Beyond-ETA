import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        resp = await client.post('http://localhost:8001/api/routes', json={'start':{'lat':12.9716,'lng':77.5946}, 'end':{'lat':13.0279,'lng':77.5409}, 'mode':'pothole'})
        data = resp.json()
        print(len(data), 'routes returned')
        if isinstance(data, list):
            for r in data:
                print(r.get('id'), r.get('mode'), r.get('distance'))
        else:
            print(data)

asyncio.run(test())
