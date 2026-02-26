# wallets/management/commands/expire_all_pending.py
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from wallets.models import WalletTransaction
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Expire ALL pending transactions regardless of age'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            help='Expire pending transactions for specific user ID only'
        )
        parser.add_argument(
            '--reference',
            type=str,
            help='Expire pending transaction with specific reference'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be expired without actually expiring'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force expire without confirmation prompt'
        )

    def handle(self, *args, **options):
        # Build the query for ALL pending transactions (no time filter)
        query = {
            'tx_type': 'CREDIT',
            'meta__status': 'pending'
        }
        
        # Apply optional filters
        if options.get('user_id'):
            query['user_id'] = options['user_id']
            self.stdout.write(f"Filtering by user ID: {options['user_id']}")
        
        if options.get('reference'):
            query['reference'] = options['reference']
            self.stdout.write(f"Filtering by reference: {options['reference']}")
        
        # Count ALL pending transactions
        pending_count = WalletTransaction.objects.filter(**query).count()
        
        if pending_count == 0:
            self.stdout.write(
                self.style.SUCCESS('No pending transactions found.')
            )
            return
        
        # Show summary
        self.stdout.write('=' * 70)
        self.stdout.write(self.style.WARNING(f'🔥 Found {pending_count} PENDING TRANSACTION(S) TO EXPIRE:'))
        self.stdout.write('=' * 70)
        
        # Get all pending transactions
        pending_txs = WalletTransaction.objects.filter(**query).order_by('-created_at')
        
        # Show statistics
        total_amount = sum(tx.amount for tx in pending_txs)
        users_affected = pending_txs.values('user').distinct().count()
        
        self.stdout.write(f"📊 Statistics:")
        self.stdout.write(f"   • Total pending amount: ₦{total_amount:,.2f}")
        self.stdout.write(f"   • Users affected: {users_affected}")
        self.stdout.write(f"   • Date range: {pending_txs.last().created_at.strftime('%Y-%m-%d %H:%M')} to {pending_txs.first().created_at.strftime('%Y-%m-%d %H:%M')}")
        self.stdout.write('=' * 70)
        
        # List all pending transactions
        self.stdout.write("\n📋 Pending Transactions:")
        for tx in pending_txs:
            age = timezone.now() - tx.created_at
            hours = age.total_seconds() / 3600
            days = age.days
            
            if days > 0:
                age_str = f"{days}d {hours % 24:.1f}h"
            else:
                age_str = f"{hours:.1f}h"
            
            self.stdout.write(
                f"  {tx.id:6d} | Ref: {tx.reference[:20]:20} | "
                f"User: {tx.user_id:5d} | ₦{tx.amount:8,.2f} | "
                f"Age: {age_str:10} | Created: {tx.created_at.strftime('%Y-%m-%d %H:%M')}"
            )
        
        self.stdout.write('=' * 70)
        
        # Dry run mode
        if options['dry_run']:
            self.stdout.write(
                self.style.SUCCESS(f'\n✅ DRY RUN: Would expire {pending_count} pending transaction(s)')
            )
            return
        
        # Confirm expiration
        if not options['force']:
            self.stdout.write('')
            confirm = input(f'⚠️  Are you sure you want to expire ALL {pending_count} pending transaction(s)? (yes/no): ')
            if confirm.lower() not in ['yes', 'y']:
                self.stdout.write(self.style.WARNING('Operation cancelled.'))
                return
            
            # Double confirmation for safety
            confirm2 = input(f'🔥 FINAL WARNING: This will affect {users_affected} user(s). Type "EXPIRE ALL" to confirm: ')
            if confirm2 != 'EXPIRE ALL':
                self.stdout.write(self.style.WARNING('Operation cancelled.'))
                return
        
        # Perform expiration
        with transaction.atomic():
            expired_count = 0
            failed_count = 0
            
            for tx in pending_txs:
                try:
                    tx.meta['status'] = 'expired'
                    tx.meta['expired_at'] = str(timezone.now())
                    tx.meta['expired_reason'] = 'Manually expired by admin (expire_all_pending command)'
                    tx.meta['expired_by'] = 'system'
                    tx.save(update_fields=['meta'])
                    expired_count += 1
                    
                    # Progress indicator
                    if expired_count % 10 == 0:
                        self.stdout.write(f"   Progress: {expired_count}/{pending_count} expired", ending='\r')
                        
                except Exception as e:
                    failed_count += 1
                    self.stdout.write(self.style.ERROR(f"\n❌ Failed to expire {tx.reference}: {str(e)}"))
            
            self.stdout.write('')
            self.stdout.write('=' * 70)
            self.stdout.write(
                self.style.SUCCESS(f'✅ SUCCESS: Expired {expired_count} pending transaction(s)')
            )
            if failed_count > 0:
                self.stdout.write(
                    self.style.ERROR(f'❌ Failed: {failed_count} transaction(s)')
                )
            
            # Show summary of expired transactions
            self.stdout.write('=' * 70)
            self.stdout.write("\n📊 Expiration Summary:")
            self.stdout.write(f"   • Total expired: {expired_count}")
            self.stdout.write(f"   • Total amount: ₦{total_amount:,.2f}")
            self.stdout.write(f"   • Users affected: {users_affected}")
            self.stdout.write('=' * 70)