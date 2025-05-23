;; Asset Verification Contract
;; Validates underlying instruments for perpetual swaps

(define-data-var admin principal tx-sender)
(define-map verified-assets (string-ascii 32) {
  price: uint,
  last-updated: uint,
  oracle: principal,
  active: bool
})

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ASSET-EXISTS u101)
(define-constant ERR-ASSET-NOT-FOUND u102)
(define-constant ERR-INVALID-PRICE u103)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin)))

;; Add a new asset to the verified list
(define-public (add-asset (asset-symbol (string-ascii 32)) (initial-price uint) (oracle principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (map-get? verified-assets asset-symbol)) (err ERR-ASSET-EXISTS))
    (asserts! (> initial-price u0) (err ERR-INVALID-PRICE))

    (map-set verified-assets asset-symbol {
      price: initial-price,
      last-updated: block-height,
      oracle: oracle,
      active: true
    })
    (ok true)))

;; Update price for an asset
(define-public (update-price (asset-symbol (string-ascii 32)) (new-price uint))
  (let ((asset (unwrap! (map-get? verified-assets asset-symbol) (err ERR-ASSET-NOT-FOUND))))
    (asserts! (or (is-admin) (is-eq tx-sender (get oracle asset))) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-price u0) (err ERR-INVALID-PRICE))

    (map-set verified-assets asset-symbol (merge asset {
      price: new-price,
      last-updated: block-height
    }))
    (ok true)))

;; Get asset price
(define-read-only (get-asset-price (asset-symbol (string-ascii 32)))
  (let ((asset (map-get? verified-assets asset-symbol)))
    (if (is-some asset)
      (ok (get price (unwrap-panic asset)))
      (err ERR-ASSET-NOT-FOUND))))

;; Check if asset is active
(define-read-only (is-asset-active (asset-symbol (string-ascii 32)))
  (let ((asset (map-get? verified-assets asset-symbol)))
    (if (is-some asset)
      (ok (get active (unwrap-panic asset)))
      (err ERR-ASSET-NOT-FOUND))))

;; Set asset active status
(define-public (set-asset-status (asset-symbol (string-ascii 32)) (active bool))
  (let ((asset (unwrap! (map-get? verified-assets asset-symbol) (err ERR-ASSET-NOT-FOUND))))
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))

    (map-set verified-assets asset-symbol (merge asset { active: active }))
    (ok true)))

;; Transfer admin rights
(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set admin new-admin)
    (ok true)))
