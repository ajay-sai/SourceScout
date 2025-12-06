import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Mail, 
  Copy, 
  Check, 
  Loader2, 
  Send,
  Sparkles 
} from "lucide-react";
import type { SupplierMatch, RfqEmail } from "@shared/schema";

interface RfqEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierMatch: SupplierMatch;
  sessionId: string;
}

export function RfqEmailModal({ isOpen, onClose, supplierMatch, sessionId }: RfqEmailModalProps) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState<string>("");
  const [additionalRequirements, setAdditionalRequirements] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState<RfqEmail | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rfq/generate", {
        sessionId,
        supplierMatchId: supplierMatch.id,
        quantity: quantity ? parseInt(quantity, 10) : undefined,
        additionalRequirements: additionalRequirements || undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedEmail(data.email);
      setEditedSubject(data.email.subject);
      setEditedBody(data.email.body);
      toast({
        title: "Email Generated",
        description: "Your RFQ email draft is ready for review.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate RFQ email.",
        variant: "destructive",
      });
    },
  });

  const handleCopy = async () => {
    const fullEmail = `Subject: ${editedSubject}\n\n${editedBody}`;
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      toast({
        title: "Copied to Clipboard",
        description: "The email has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy email to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(editedBody);
      setCopied(true);
      toast({
        title: "Body Copied",
        description: "The email body has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy email body.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setGeneratedEmail(null);
    setEditedSubject("");
    setEditedBody("");
    setQuantity("");
    setAdditionalRequirements("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Generate RFQ Email
          </DialogTitle>
        </DialogHeader>

        {!generatedEmail ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-1">Supplier</p>
              <p className="font-medium" data-testid="text-rfq-supplier">{supplierMatch.supplierName}</p>
              <p className="text-sm text-muted-foreground mt-2">{supplierMatch.productName}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (optional)</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="e.g., 1000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="input-rfq-quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements">Additional Requirements (optional)</Label>
              <Textarea
                id="requirements"
                placeholder="Any specific requirements, customizations, or questions..."
                value={additionalRequirements}
                onChange={(e) => setAdditionalRequirements(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-rfq-requirements"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                data-testid="input-rfq-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                data-testid="input-rfq-body"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {!generatedEmail ? (
            <>
              <Button variant="outline" onClick={handleClose} data-testid="button-rfq-cancel">
                Cancel
              </Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-2"
                data-testid="button-rfq-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Email
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setGeneratedEmail(null);
                  setEditedSubject("");
                  setEditedBody("");
                }}
                data-testid="button-rfq-regenerate"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyBody}
                className="gap-2"
                data-testid="button-rfq-copy-body"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy Body
              </Button>
              <Button
                onClick={handleCopy}
                className="gap-2"
                data-testid="button-rfq-copy"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy Full Email
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
