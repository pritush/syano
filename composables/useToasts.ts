/**
 * Composable for consistent toast notifications across the application
 */
export function useToasts() {
  const toast = useToast()

  return {
    /**
     * Show a success toast
     */
    success: (title: string, description?: string) => {
      toast.add({
        title,
        description,
        color: 'success',
        icon: 'lucide:check-circle-2',
      })
    },

    /**
     * Show an error toast
     */
    error: (title: string, description?: string) => {
      toast.add({
        title,
        description,
        color: 'error',
        icon: 'lucide:alert-circle',
      })
    },

    /**
     * Show a toast for successful deletion
     */
    deleted: (itemName: string, itemType?: string) => {
      toast.add({
        title: `${itemType || 'Item'} deleted`,
        description: `Successfully deleted ${itemName}`,
        color: 'success',
        icon: 'lucide:trash-2',
      })
    },

    /**
     * Show a toast for successful creation
     */
    created: (itemName: string, itemType?: string) => {
      toast.add({
        title: `${itemType || 'Item'} created`,
        description: `Successfully created ${itemName}`,
        color: 'success',
        icon: 'lucide:plus-circle',
      })
    },

    /**
     * Show a toast for successful save/update
     */
    saved: (itemName?: string) => {
      toast.add({
        title: 'Saved',
        description: itemName ? `${itemName} has been saved` : 'Changes have been saved successfully',
        color: 'success',
        icon: 'lucide:check-circle-2',
      })
    },

    /**
     * Show a toast for successful copy
     */
    copied: (itemName: string) => {
      toast.add({
        title: 'Copied!',
        description: `${itemName} copied to clipboard`,
        color: 'success',
        icon: 'lucide:check-circle-2',
      })
    },
  }
}
