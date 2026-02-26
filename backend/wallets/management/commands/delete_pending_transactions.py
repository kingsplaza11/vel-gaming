# wallets/management/commands/delete_pending_transactions.py
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from wallets.models import WalletTransaction
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Delete all pending transactions or filter by various criteria'

    def add_arguments(self, parser):
        # Optional arguments for filtering
        parser.add_argument(
            '--user-id',
            type=int,
            help='Delete pending transactions for specific user ID only'
        )
        parser.add_argument(
            '--older-than',
            type=int,
            help='Delete pending transactions older than X hours'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting'
        )
        parser.add_argument(
            '--reference',
            type=str,
            help='Delete pending transaction with specific reference'
        )
        parser.add_argument(
            '--amount',
            type=float,
            help='Delete pending transactions with specific amount'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force delete without confirmation prompt'
        )

    def handle(self, *args, **options):
        # Build the query
        query = {
            'tx_type': 'CREDIT',
            'meta__status': 'pending'
        }
        
        # Apply filters
        if options.get('user_id'):
            query['user_id'] = options['user_id']
            self.stdout.write(f"Filtering by user ID: {options['user_id']}")
        
        if options.get('reference'):
            query['reference'] = options['reference']
            self.stdout.write(f"Filtering by reference: {options['reference']}")
        
        if options.get('amount'):
            query['amount'] = options['amount']
            self.stdout.write(f"Filtering by amount: {options['amount']}")
        
        if options.get('older_than'):
            time_threshold = timezone.now() - timedelta(hours=options['older_than'])
            query['created_at__lt'] = time_threshold
            self.stdout.write(f"Filtering by created_at < {time_threshold}")
        
        # Count pending transactions
        pending_count = WalletTransaction.objects.filter(**query).count()
        
        if pending_count == 0:
            self.stdout.write(
                self.style.SUCCESS('No pending transactions found matching the criteria.')
            )
            return
        
        # Show summary
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.WARNING(f'Found {pending_count} pending transaction(s) to delete:'))
        self.stdout.write('=' * 60)
        
        # List pending transactions
        pending_txs = WalletTransaction.objects.filter(**query).order_by('-created_at')
        
        for tx in pending_txs:
            self.stdout.write(
                f"  • Ref: {tx.reference} | User: {tx.user_id} | Amount: ₦{tx.amount} | "
                f"Created: {tx.created_at.strftime('%Y-%m-%d %H:%M')} | "
                f"Meta status: {tx.meta.get('status', 'unknown')}"
            )
        
        self.stdout.write('=' * 60)
        
        # Dry run mode
        if options['dry_run']:
            self.stdout.write(
                self.style.SUCCESS(f'DRY RUN: Would delete {pending_count} pending transaction(s)')
            )
            return
        
        # Confirm deletion
        if not options['force']:
            confirm = input(f'\nAre you sure you want to delete {pending_count} pending transaction(s)? (yes/no): ')
            if confirm.lower() not in ['yes', 'y']:
                self.stdout.write(self.style.WARNING('Operation cancelled.'))
                return
        
        # Perform deletion
        with transaction.atomic():
            deleted_count, details = WalletTransaction.objects.filter(**query).delete()
            
            self.stdout.write('=' * 60)
            self.stdout.write(
                self.style.SUCCESS(f'✅ Successfully deleted {deleted_count} pending transaction(s)')
            )
            
            # Show details of what was deleted
            if details:
                self.stdout.write('\nDeletion details:')
                for model, count in details.items():
                    self.stdout.write(f'  • {model}: {count}')
            
            self.stdout.write('=' * 60)