# wallet/webhooks.py

@csrf_exempt
def paystack_webhook(request):
    payload = json.loads(request.body)

    if payload["event"] == "transfer.success":
        ref = payload["data"]["reference"]
        WalletTransaction.objects.filter(reference=ref).update(
            meta={"status": "success"}
        )

    elif payload["event"] == "transfer.failed":
        ref = payload["data"]["reference"]
        tx = WalletTransaction.objects.get(reference=ref)

        wallet = Wallet.objects.get(user=tx.user)
        wallet.balance += tx.amount
        wallet.save()

        tx.meta["status"] = "failed"
        tx.save()

    return HttpResponse(status=200)
